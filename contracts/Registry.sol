// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./IMarket.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Registry {

    address[] public markets;
    IVault[] public vaults;

    mapping(address => IVault) private _underlying;
    mapping(address => address) private _markets;

    address immutable private _owner;
    IERC20Metadata immutable private _token;
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

    function addVault(IVault vault) external onlyTokenHolders() {
        IERC20Metadata underlying = vault.asset();
        require(address(_underlying[address(underlying)]) == address(0), "addVault: Vault with this underlying token already added");

        vaults.push(vault);
        _underlying[address(underlying)] = vault; // underlying => vault

        emit VaultAdded(address(vault));
    }

    function addMarket(address market) external onlyTokenHolders() {
        require(_markets[market] == address(0), "addMarket: Market already added");
        markets.push(market);
        emit MarketAdded(market);
    }

    function setThreshold(uint256 threshold) external onlyOwner {
        _threshold = threshold;
        emit ThresholdUpdated(threshold);
    }

    modifier onlyTokenHolders() {
        require(_token.balanceOf(msg.sender) >= _threshold, "onlyTokenHolders: Caller does not hold enough tokens");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == _owner, "onlyOwner: Caller is not the contract owner");
        _;
    }

    event ThresholdUpdated(uint256 threshold);
    event MarketAdded(address indexed market);
    event VaultAdded(address indexed vault);
}
