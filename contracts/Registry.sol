// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./IMarket.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Registry {
    address[] public markets;
    address[] public vaults;

    mapping(address => address) private _vaultByAsset;
    mapping(address => address) private _markets; 

    address private immutable _owner;
    IERC20Metadata private immutable _token;
    uint256 private _threshold;

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    constructor(IERC20Metadata token) {
        _owner = msg.sender;
        _token = token;
    }

    function addVault(address vault) external onlyTokenHolders {
        address assetAddress = IVault(vault).asset();
        require(_vaultByAsset[assetAddress] == address(0), "addVault: Vault with this asset token already added");

        vaults.push(vault);
        _vaultByAsset[assetAddress] = vault; 

        emit VaultAdded(vault);
    }

    function addMarket(address market) external onlyTokenHolders {
        require(
            _markets[market] == address(0),
            "addMarket: Market already added"
        );
        _markets[market] = market;
        markets.push(market);
        emit MarketAdded(market);
    }

    function setThreshold(uint256 threshold) external onlyOwner {
        require(threshold != _threshold, "setThreshold: Threshold already set");
        _threshold = threshold;
        emit ThresholdUpdated(threshold);
    }

    modifier onlyTokenHolders() {
        require(
            _token.balanceOf(msg.sender) >= _threshold,
            "onlyTokenHolders: Caller does not hold enough tokens"
        );
        _;
    }

    modifier onlyOwner() {
        require(
            msg.sender == _owner,
            "onlyOwner: Caller is not the contract owner"
        );
        _;
    }

    event MarketAdded(address indexed market);
    event ThresholdUpdated(uint256 threshold);
    event VaultAdded(address indexed vault);
}
