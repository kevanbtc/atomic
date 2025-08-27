const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CBDCBridge", function () {
    let CBDCBridge, cbdcBridge;
    let MockCBDCValidator, mockValidator;
    let MockERC20, sourceToken, targetToken;
    let owner, validator1, validator2, user1, user2;

    beforeEach(async function () {
        [owner, validator1, validator2, user1, user2] = await ethers.getSigners();

        // Deploy mock validator
        MockCBDCValidator = await ethers.getContractFactory("MockCBDCValidator");
        mockValidator = await MockCBDCValidator.deploy();
        await mockValidator.waitForDeployment();

        // Deploy CBDCBridge
        CBDCBridge = await ethers.getContractFactory("CBDCBridge");
        cbdcBridge = await CBDCBridge.deploy(await mockValidator.getAddress());
        await cbdcBridge.waitForDeployment();

        // Deploy mock CBDC tokens
        MockERC20 = await ethers.getContractFactory("MockERC20");
        sourceToken = await MockERC20.deploy("Source CBDC", "SCBDC", ethers.parseEther("1000000"));
        await sourceToken.waitForDeployment();
        
        targetToken = await MockERC20.deploy("Target CBDC", "TCBDC", ethers.parseEther("1000000"));
        await targetToken.waitForDeployment();

        // Setup authorized CBDCs
        await mockValidator.setAuthorizedCBDC(await sourceToken.getAddress(), true);
        await mockValidator.setAuthorizedCBDC(await targetToken.getAddress(), true);

        // Transfer tokens to users and bridge
        await sourceToken.transfer(user1.address, ethers.parseEther("100000"));
        await sourceToken.transfer(user2.address, ethers.parseEther("100000"));
        await targetToken.transfer(await cbdcBridge.getAddress(), ethers.parseEther("100000"));

        // Set token limits
        await cbdcBridge.setTokenLimit(await sourceToken.getAddress(), ethers.parseEther("50000")); // 50k daily limit
        await cbdcBridge.setTokenLimit(await targetToken.getAddress(), ethers.parseEther("50000"));
    });

    describe("Deployment", function () {
        it("Should set the correct validator address", async function () {
            expect(await cbdcBridge.cbdcValidator()).to.equal(await mockValidator.getAddress());
        });

        it("Should set the correct owner", async function () {
            expect(await cbdcBridge.owner()).to.equal(owner.address);
        });

        it("Should authorize owner as validator by default", async function () {
            expect(await cbdcBridge.authorizedValidators(owner.address)).to.be.true;
        });

        it("Should have correct constants", async function () {
            expect(await cbdcBridge.MIN_CONFIRMATION_TIME()).to.equal(300); // 5 minutes
            expect(await cbdcBridge.MAX_TRANSACTION_AMOUNT()).to.equal(ethers.parseEther("1000000"));
            expect(await cbdcBridge.bridgeFee()).to.equal(10); // 0.1%
        });
    });

    describe("Validator Management", function () {
        it("Should add validator successfully", async function () {
            await expect(cbdcBridge.addValidator(validator1.address))
                .to.emit(cbdcBridge, "ValidatorAdded")
                .withArgs(validator1.address);

            expect(await cbdcBridge.authorizedValidators(validator1.address)).to.be.true;
        });

        it("Should remove validator successfully", async function () {
            await cbdcBridge.addValidator(validator1.address);
            
            await expect(cbdcBridge.removeValidator(validator1.address))
                .to.emit(cbdcBridge, "ValidatorRemoved")
                .withArgs(validator1.address);

            expect(await cbdcBridge.authorizedValidators(validator1.address)).to.be.false;
        });

        it("Should reject adding zero address validator", async function () {
            await expect(cbdcBridge.addValidator(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid validator address");
        });

        it("Should only allow owner to manage validators", async function () {
            await expect(
                cbdcBridge.connect(user1).addValidator(validator1.address)
            ).to.be.revertedWithCustomError(cbdcBridge, "OwnableUnauthorizedAccount");

            await expect(
                cbdcBridge.connect(user1).removeValidator(owner.address)
            ).to.be.revertedWithCustomError(cbdcBridge, "OwnableUnauthorizedAccount");
        });
    });

    describe("Token Limit Management", function () {
        it("Should set token limit successfully", async function () {
            const newLimit = ethers.parseEther("100000");
            
            await expect(cbdcBridge.setTokenLimit(await sourceToken.getAddress(), newLimit))
                .to.emit(cbdcBridge, "TokenLimitSet")
                .withArgs(await sourceToken.getAddress(), newLimit);

            expect(await cbdcBridge.tokenLimits(await sourceToken.getAddress())).to.equal(newLimit);
        });

        it("Should only allow owner to set token limits", async function () {
            await expect(
                cbdcBridge.connect(user1).setTokenLimit(await sourceToken.getAddress(), ethers.parseEther("100000"))
            ).to.be.revertedWithCustomError(cbdcBridge, "OwnableUnauthorizedAccount");
        });
    });

    describe("Bridge Initiation", function () {
        beforeEach(async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
        });

        it("Should initiate bridge successfully", async function () {
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n; // 0.1% fee
            const targetChain = 137; // Polygon

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                targetChain,
                { value: fee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            
            expect(event).to.not.be.undefined;
            expect(await sourceToken.balanceOf(await cbdcBridge.getAddress())).to.equal(amount);
        });

        it("Should reject invalid amount", async function () {
            const amount = 0;
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    targetChain
                )
            ).to.be.revertedWith("Invalid amount");
        });

        it("Should reject amount exceeding maximum", async function () {
            const maxAmount = await cbdcBridge.MAX_TRANSACTION_AMOUNT();
            const excessAmount = maxAmount + ethers.parseEther("1");
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    excessAmount,
                    targetChain
                )
            ).to.be.revertedWith("Invalid amount");
        });

        it("Should reject invalid recipient", async function () {
            const amount = ethers.parseEther("1000");
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    ethers.ZeroAddress,
                    amount,
                    targetChain
                )
            ).to.be.revertedWith("Invalid recipient");
        });

        it("Should reject unauthorized source token", async function () {
            await mockValidator.setAuthorizedCBDC(await sourceToken.getAddress(), false);
            
            const amount = ethers.parseEther("1000");
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    targetChain
                )
            ).to.be.revertedWith("Unauthorized source token");
        });

        it("Should reject unauthorized target token", async function () {
            await mockValidator.setAuthorizedCBDC(await targetToken.getAddress(), false);
            
            const amount = ethers.parseEther("1000");
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    targetChain
                )
            ).to.be.revertedWith("Unauthorized target token");
        });

        it("Should reject exceeding daily limit", async function () {
            const amount1 = ethers.parseEther("30000");
            const amount2 = ethers.parseEther("25000"); // Total would exceed 50k limit
            const targetChain = 137;
            const fee1 = amount1 * 10n / 10000n;
            const fee2 = amount2 * 10n / 10000n;

            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), amount1 + amount2);

            // First transaction should succeed
            await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount1,
                targetChain,
                { value: fee1 }
            );

            // Second transaction should fail
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount2,
                    targetChain,
                    { value: fee2 }
                )
            ).to.be.revertedWith("Daily limit exceeded");
        });

        it("Should reject insufficient bridge fee", async function () {
            const amount = ethers.parseEther("1000");
            const insufficientFee = amount * 5n / 10000n; // 0.05% instead of 0.1%
            const targetChain = 137;

            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    targetChain,
                    { value: insufficientFee }
                )
            ).to.be.revertedWith("Insufficient bridge fee");
        });
    });

    describe("Bridge Completion", function () {
        let txId;

        beforeEach(async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
            await cbdcBridge.addValidator(validator1.address);
            
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            const targetChain = 137;

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                targetChain,
                { value: fee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            txId = event.args[0]; // First argument is txId

            // Set up mock validator to approve this transaction
            await mockValidator.setTransactionValidation(txId, true);
        });

        it("Should complete bridge successfully after confirmation time", async function () {
            // Fast forward time by 6 minutes (beyond MIN_CONFIRMATION_TIME)
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(txId, signature)
            ).to.emit(cbdcBridge, "BridgeCompleted")
                .withArgs(txId, user2.address);

            const transaction = await cbdcBridge.bridgeTransactions(txId);
            expect(transaction.completed).to.be.true;
        });

        it("Should reject completion before minimum confirmation time", async function () {
            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(txId, signature)
            ).to.be.revertedWith("Minimum confirmation time not met");
        });

        it("Should reject completion from unauthorized validator", async function () {
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await expect(
                cbdcBridge.connect(user1).completeBridge(txId, signature)
            ).to.be.revertedWith("Not authorized validator");
        });

        it("Should reject completion of non-existent transaction", async function () {
            const fakeTxId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(fakeTxId, signature)
            ).to.be.revertedWith("Transaction does not exist");
        });

        it("Should reject completion of already completed transaction", async function () {
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await cbdcBridge.connect(validator1).completeBridge(txId, signature);
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(txId, signature)
            ).to.be.revertedWith("Transaction already completed");
        });

        it("Should reject completion with invalid validator signature", async function () {
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");

            await mockValidator.setTransactionValidation(txId, false);
            const signature = ethers.toUtf8Bytes("invalid_signature");
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(txId, signature)
            ).to.be.revertedWith("Invalid validator signature");
        });
    });

    describe("Bridge Cancellation", function () {
        let txId;

        beforeEach(async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
            
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            const targetChain = 137;

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                targetChain,
                { value: fee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            txId = event.args[0];
        });

        it("Should cancel bridge by sender", async function () {
            const reason = "User requested cancellation";
            
            await expect(cbdcBridge.connect(user1).cancelBridge(txId, reason))
                .to.emit(cbdcBridge, "BridgeCancelled")
                .withArgs(txId, reason);

            const transaction = await cbdcBridge.bridgeTransactions(txId);
            expect(transaction.cancelled).to.be.true;
            
            // Should return tokens to sender
            expect(await sourceToken.balanceOf(user1.address)).to.be.gt(0);
        });

        it("Should cancel bridge by owner", async function () {
            const reason = "Admin cancellation";
            
            await expect(cbdcBridge.connect(owner).cancelBridge(txId, reason))
                .to.emit(cbdcBridge, "BridgeCancelled")
                .withArgs(txId, reason);
        });

        it("Should reject cancellation by unauthorized user", async function () {
            const reason = "Unauthorized cancellation";
            
            await expect(
                cbdcBridge.connect(user2).cancelBridge(txId, reason)
            ).to.be.revertedWith("Only sender or owner can cancel");
        });

        it("Should reject cancellation of non-existent transaction", async function () {
            const fakeTxId = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            const reason = "Non-existent transaction";
            
            await expect(
                cbdcBridge.connect(user1).cancelBridge(fakeTxId, reason)
            ).to.be.revertedWith("Transaction does not exist");
        });

        it("Should reject cancellation of completed transaction", async function () {
            // Complete the transaction first
            await cbdcBridge.addValidator(validator1.address);
            await mockValidator.setTransactionValidation(txId, true);
            await ethers.provider.send("evm_increaseTime", [360]);
            await ethers.provider.send("evm_mine");
            
            const signature = ethers.toUtf8Bytes("mock_signature");
            await cbdcBridge.connect(validator1).completeBridge(txId, signature);
            
            const reason = "Completed transaction";
            await expect(
                cbdcBridge.connect(user1).cancelBridge(txId, reason)
            ).to.be.revertedWith("Transaction already completed");
        });

        it("Should reject cancellation of already cancelled transaction", async function () {
            await cbdcBridge.connect(user1).cancelBridge(txId, "First cancellation");
            
            await expect(
                cbdcBridge.connect(user1).cancelBridge(txId, "Second cancellation")
            ).to.be.revertedWith("Transaction already cancelled");
        });
    });

    describe("View Functions", function () {
        let txId;

        beforeEach(async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
            
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            const targetChain = 137;

            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                targetChain,
                { value: fee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            txId = event.args[0];
        });

        it("Should return bridge transaction details", async function () {
            const transaction = await cbdcBridge.getBridgeTransaction(txId);
            
            expect(transaction.txId).to.equal(txId);
            expect(transaction.sourceToken).to.equal(await sourceToken.getAddress());
            expect(transaction.targetToken).to.equal(await targetToken.getAddress());
            expect(transaction.sender).to.equal(user1.address);
            expect(transaction.recipient).to.equal(user2.address);
            expect(transaction.amount).to.equal(ethers.parseEther("1000"));
            expect(transaction.completed).to.be.false;
            expect(transaction.cancelled).to.be.false;
        });

        it("Should return daily volume", async function () {
            const today = Math.floor(Date.now() / 86400000); // Days since epoch
            const volume = await cbdcBridge.getDailyVolume(await sourceToken.getAddress(), today);
            expect(volume).to.equal(ethers.parseEther("1000"));
        });

        it("Should return today's volume", async function () {
            const volume = await cbdcBridge.getTodayVolume(await sourceToken.getAddress());
            expect(volume).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Administrative Functions", function () {
        it("Should set bridge fee", async function () {
            const newFee = 20; // 0.2%
            
            await cbdcBridge.setBridgeFee(newFee);
            expect(await cbdcBridge.bridgeFee()).to.equal(newFee);
        });

        it("Should reject bridge fee too high", async function () {
            const highFee = 1100; // 11%
            
            await expect(cbdcBridge.setBridgeFee(highFee))
                .to.be.revertedWith("Fee too high");
        });

        it("Should set CBDC validator", async function () {
            const newValidator = await MockCBDCValidator.deploy();
            await newValidator.waitForDeployment();

            await cbdcBridge.setCBDCValidator(await newValidator.getAddress());
            expect(await cbdcBridge.cbdcValidator()).to.equal(await newValidator.getAddress());
        });

        it("Should reject zero address for CBDC validator", async function () {
            await expect(cbdcBridge.setCBDCValidator(ethers.ZeroAddress))
                .to.be.revertedWith("Invalid validator address");
        });

        it("Should emergency withdraw tokens", async function () {
            // First, put some tokens in the bridge
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("1000"));
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );

            const balanceBefore = await sourceToken.balanceOf(owner.address);
            await cbdcBridge.emergencyWithdraw(await sourceToken.getAddress(), amount);
            const balanceAfter = await sourceToken.balanceOf(owner.address);

            expect(balanceAfter).to.equal(balanceBefore + amount);
        });

        it("Should withdraw ETH fees", async function () {
            // First, generate some fees
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("1000"));
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );

            const balanceBefore = await ethers.provider.getBalance(owner.address);
            const tx = await cbdcBridge.withdraw();
            const receipt = await tx.wait();
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(owner.address);

            expect(balanceAfter).to.be.closeTo(balanceBefore + fee - gasCost, ethers.parseEther("0.001"));
        });
    });

    describe("Pausability", function () {
        beforeEach(async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("10000"));
        });

        it("Should pause and unpause contract", async function () {
            await cbdcBridge.pause();
            
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    137,
                    { value: fee }
                )
            ).to.be.revertedWithCustomError(cbdcBridge, "EnforcedPause");

            await cbdcBridge.unpause();
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    amount,
                    137,
                    { value: fee }
                )
            ).to.not.be.reverted;
        });
    });

    describe("Edge Cases", function () {
        it("Should handle minimum transaction amount", async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), 1);
            
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    1, // 1 wei
                    137,
                    { value: 1 } // Minimal fee
                )
            ).to.not.be.reverted;
        });

        it("Should handle maximum transaction amount", async function () {
            const maxAmount = await cbdcBridge.MAX_TRANSACTION_AMOUNT();
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), maxAmount);
            
            await expect(
                cbdcBridge.connect(user1).initiateBridge(
                    await sourceToken.getAddress(),
                    await targetToken.getAddress(),
                    user2.address,
                    maxAmount,
                    137,
                    { value: maxAmount * 10n / 10000n }
                )
            ).to.not.be.reverted;
        });

        it("Should handle minimum confirmation time boundary", async function () {
            await sourceToken.connect(user1).approve(await cbdcBridge.getAddress(), ethers.parseEther("1000"));
            
            const amount = ethers.parseEther("1000");
            const fee = amount * 10n / 10000n;
            
            const tx = await cbdcBridge.connect(user1).initiateBridge(
                await sourceToken.getAddress(),
                await targetToken.getAddress(),
                user2.address,
                amount,
                137,
                { value: fee }
            );

            const receipt = await tx.wait();
            const event = receipt.logs.find(log => log.fragment?.name === "BridgeInitiated");
            const txId = event.args[0];

            await cbdcBridge.addValidator(validator1.address);
            await mockValidator.setTransactionValidation(txId, true);

            // Exactly at minimum confirmation time
            await ethers.provider.send("evm_increaseTime", [300]);
            await ethers.provider.send("evm_mine");

            const signature = ethers.toUtf8Bytes("mock_signature");
            
            await expect(
                cbdcBridge.connect(validator1).completeBridge(txId, signature)
            ).to.not.be.reverted;
        });
    });
});