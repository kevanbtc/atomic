pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard {

    IERC721 public immutable nftContract;
    uint256 public feePercentage = 5; // 5% fee
    address public feeRecipient;

    struct Listing {
        uint256 price;
        address seller;
    }

    mapping(uint256 => Listing) public listings;

    constructor(address _nftContract, address _feeRecipient) {
        nftContract = IERC721(_nftContract);
        feeRecipient = _feeRecipient;
    }

    function list(uint256 tokenId, uint256 price) external nonReentrant {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Only owner can list");
        nftContract.transferFrom(msg.sender, address(this), tokenId);
        listings[tokenId] = Listing({price: price, seller: msg.sender});
    }

    function purchase(uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.price > 0, "Not for sale");
        require(msg.value >= listing.price, "Insufficient amount");

        uint256 fee = (listing.price * feePercentage) / 100;
        uint256 sellerAmount = listing.price - fee;

        nftContract.transferFrom(address(this), msg.sender, tokenId);
        payable(listing.seller).transfer(sellerAmount);
        payable(feeRecipient).transfer(fee);

        delete listings[tokenId];
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[tokenId];
        require(listing.seller == msg.sender, "Not seller");
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        delete listings[tokenId];
    }
}

