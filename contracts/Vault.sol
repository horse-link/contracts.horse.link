// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
import "./ERC4626Metadata.sol";
import "./Market.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vault is ERC4626Metadata, Ownable {

    using Math for uint256;
    using SafeERC20 for IERC20;

    // These will change to allow multiple markets
    address private _market;
    address private _self;
    uint256 private _rate;

    constructor(IERC20Metadata asset_)
    ERC4626Metadata(
        asset_
    ) 
    ERC20(
        string(abi.encodePacked("HL ", asset_.name())),
        string(abi.encodePacked("HL", asset_.symbol()))
    ) {
        require(
            address(asset_) != address(0),
            "Underlying address is invalid"
        );
        _self = address(this);
    }

    // Override decimals to be the same as the underlying asset
    /*function decimals() public view override returns (uint8) {
        return _decimals;
    }*/

    function setMarket(address market, uint256 max, uint256 rate) public onlyOwner {
        require(_market == address(0), "setMarket: Market already set");
        _market = market;
        _rate = rate;
        IERC20(asset()).approve(_market, max);
    }

    function getMarket() external view returns (address) {
        return _market;
    }

    function getPerformance() external view returns (uint256) {
        return _getPerformance();
    }

    function _getPerformance() private view returns (uint256) {
        uint256 underlyingBalance = totalAssets();
        if (underlyingBalance > 0)
            return (totalSupply() * 100) / underlyingBalance;

        return 0;
    }

    function getRate() external view returns (uint256);
        return _rate;
    }

    // If receiver is omitted, use the sender
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        if (receiver == address(0)) receiver = _msgSender();
        return super.deposit(assets, receiver);
    }

    function getMarketAllowance() external view withMarket returns (uint256) {
        // TODO: This will change to allow multiple markets, using msg.sender
        uint256 allowance = ERC20(asset()).allowance(_self, _market);
        if (allowance > totalAssets()) {
            return totalAssets();
        }
        
        return allowance;
    }

    // Total Assets = amount held by the vault, plus amount lent to the market and therefore locked
    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(_self);
    }

    function totalAssetsLocked() external view returns (uint256) {
        return IMarket(_market).getTotalExposure();
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view override returns (uint256) {
        if (totalAssets() == 0) return 0;

        // A fraction of the total assets is locked is locked for the owner, proportional to their holdings.
        uint256 shareBalance = balanceOf(owner);
        uint256 sharesLockedForOwner = shareBalance / totalAssets();
        return shareBalance - sharesLockedForOwner;
    }

    modifier onlyMarket() {
        require(_market != address(0), "onlyMarket: Market not set");
        require(
            msg.sender == _market,
            "onlyMarket: Only the market can call this function"
        );
        _;
    }

    modifier withMarket() {
        require(
            _market != address(0),
            "deposit: Not allowed until market is set"
        );
        _;
    }
}
