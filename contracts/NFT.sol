// SPDX-License-Identifier: MIT
pragma solidity ^0.8.3;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract NFT is ERC721Enumerable, Ownable {
    /** @dev Counts the number of tokens minted */
    using Counters for Counters.Counter;

    /** @dev This contract's address. */
    address private immutable _self;

    /** @dev The base NFT URI. **/
    string private baseURI;

    /** @dev This address is used for if current owner want to renounceOwnership. */
    address private immutable fixedOwnerAddress;

    /** @dev Counter to keep track of tokens minted. */
    Counters.Counter private tokenCounter;

    /** @dev The maximum supply of tokens. */
    uint16 public immutable maxTokens;

    /** @dev Sets whether minting is enabled. */
    bool public isMintEnabled;

    /** @dev Emits event for when base URI changes */
    event BaseUriChanged(string indexed newBaseUri);

    /** @dev Emits event for when minting is enabled/disabled */
    event MintStatusChanged(bool updatedMintStatus);

    constructor(
        string memory name_,
        string memory symbol_,
        uint16 _maxTokens,
        address _fixedOwnerAddress,
        string memory _baseURI
    ) ERC721(name_, symbol_) {
        _self = address(this);
        maxTokens = _maxTokens;
        fixedOwnerAddress = _fixedOwnerAddress;
        baseURI = _baseURI;
    }

    // MODIFIERS
    modifier mintEnabled() {
        require(isMintEnabled, "Minting is not enabled");
        _;
    }

    modifier canMintTokens(uint256 numberOfTokens) {
        require(
            tokenCounter.current() + numberOfTokens <= maxTokens,
            "Not enough tokens remaining to mint"
        );
        _;
    }

    // PUBLIC READ-ONLY FUNCTIONS
    function getBaseURI() external view returns (string memory) {
        return baseURI;
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Nonexistent token");

        return string(abi.encodePacked(baseURI, "/", tokenId, ".json"));
    }

    // ONLY OWNER FUNCTIONS
    function setBaseURI(string memory _baseURI) external onlyOwner {
        baseURI = _baseURI;
        emit BaseUriChanged(_baseURI);
    }

    function toggleMintStatus() external onlyOwner {
        isMintEnabled = !isMintEnabled;
        emit MintStatusChanged(isMintEnabled);
    }

    // SUPPORTING FUNCTIONS
    function increasedTokenId() private returns (uint256) {
        tokenCounter.increment();
        return tokenCounter.current();
    }

    function getLastTokenId() external view returns (uint256) {
        return tokenCounter.current();
    }

    // FUNCTION FOR MINTING
    function mint(uint256 numberOfTokens, address userAddress)
        external
        mintEnabled
        onlyOwner
        canMintTokens(numberOfTokens)
    {
        for (uint256 i = 0; i < numberOfTokens; i++) {
            _safeMint(userAddress, increasedTokenId());
        }
    }

    /// @dev Override renounceOwnership to transfer ownership to a fixed address, make sure contract owner will never be address(0)
    function renounceOwnership() public override onlyOwner {
        _transferOwnership(fixedOwnerAddress);
    }
}
