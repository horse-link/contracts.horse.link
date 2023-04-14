// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./IMarket.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract Registry is IContractsRegistry {
    address[] public markets;
    address[] public vaults;

    mapping(address => address) private _vaultByAsset;
    mapping(address => address) private _markets; 

    address private immutable _owner;
    IERC20Metadata private immutable _token;
    uint256 private _threshold;

    mapping (string => address) private _contracts;

    function marketCount() external view returns (uint256) {
        return markets.length;
    }

    function vaultCount() external view returns (uint256) {
        return vaults.length;
    }

    function getContract(string memory name) external view returns (address) {
        return _contracts[name];
    }

    function hasContract(string memory name) external view returns (bool) {
        return _contracts[name] != address(0);
    }

    function getImplementation(string memory name) external view returns (address) {
        return _contracts[name];
    }

    constructor(IERC20Metadata token) {
        _owner = msg.sender;
        _token = token;
    }

    function upgradeContract(string memory name, address newImplementation) external {
        require(
            IOwnable(_contract).getOwner() == msg.sender,
            "upgradeContract: Only owner can upgrade contracts"
        );

        require(_contracts[name] != address(0), "upgradeContract: Contract not found");
        require(newImplementation != address(0), "upgradeContract: New implementation address is invalid");
        _contracts[name] = newImplementation;
        emit ContractUpgraded(name, newImplementation);
    }

    function addVault(address vault) external onlyTokenHolders {
        require(vault != address(0), "addVault: Vault address is invalid");
        address assetAddress = IVault(vault).asset();
        require(_vaultByAsset[assetAddress] == address(0), "addVault: Vault with this asset token already added");

        vaults.push(vault);
        _vaultByAsset[assetAddress] = vault; 

        emit VaultAdded(vault);
    }

    function removeVault(uint256 index, address vault) external onlyVaultOwner(vault) {
        if (index >= vaults.length) return;

        for (uint256 i = index; i < vaults.length - 1; i++){
            vaults[i] = vaults[i+1];
        }

        vaults.pop();

        delete _vaultByAsset[vault];
        emit VaultRemoved(vault);
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

    function removeMarket(uint256 index, address market) external onlyContractOwner(market) {
        if (index >= markets.length) return;

        for (uint256 i = index; i < markets.length - 1; i++){
            markets[i] = markets[i+1];
        }

        markets.pop();

        delete _markets[market];
        emit MarketRemoved(market);
    }

    function setThreshold(uint256 threshold) external onlyOwner {
        require(threshold != _threshold, "setThreshold: Threshold already set");
        _threshold = threshold;
        emit ThresholdUpdated(threshold);
    }

    // modifier onlyMarketOwner(address market) {
    //     require(
    //         IMarket(_markets[market]).getOwner() == msg.sender,
    //         "onlyMarketOwner: Caller is not the market owner"
    //     );
    //     _;
    // }

    modifier onlyContractOwner(address _contract) {
        require(
            IOwnable(_contract).getOwner() == msg.sender,
            "onlyContractOwner: Caller is not the contract owner"
        );
        _;
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

    // event MarketAdded(address indexed market);
    // event MarketRemoved(address indexed market);
    event ThresholdUpdated(uint256 threshold);
    // event VaultAdded(address indexed vault);
    // event VaultRemoved(address indexed vault);
}
