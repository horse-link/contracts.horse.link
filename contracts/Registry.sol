// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./I6224.sol";
import "./IMarket.sol";
import "./IOwnable.sol";
import "./IVault.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

contract Registry is IOwnable {
    address[] public markets;
    address[] public vaults;

    mapping(address => address) private _vaultByAsset;
    mapping(address => address) private _markets; 
    mapping (string => address) private _contracts;

    address private immutable _owner;
    IERC20Metadata private immutable _token;
    uint256 private _threshold;

    function getOwner() external view returns (address) {
        return _owner;
    }

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
        return _hasContract(name);
    }

    function _hasContract(string memory name) prviate view returns (bool) {
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
        require(_contracts[name] != address(0), "upgradeContract: Contract not found");
        require(newImplementation != address(0), "upgradeContract: New implementation address is invalid");
        
        // Old contract address
        address contractAddress = _contracts[name];
        require(
            IOwnable(contractAddress).getOwner() == msg.sender,
            "upgradeContract: Only owner can upgrade contracts"
        );

        address market = IVault(contractAddress).getMarket();
        // _removeMarket(index, market);

        _contracts[name] = newImplementation;
        emit ContractUpgraded(name, newImplementation);
    }

    function addContract(string memory name, address contractAddress) external {
        require(!_hasContract(name), "addContract: Contract already added");
        require(contractAddress != address(0), "addContract: Contract address is invalid");

        assert(markets.length == vaults.length);

        address market = IVault(contractAddress).getMarket();
        require(market != address(0), "addContract: Market has not been set");

        _contracts[name] = contractAddress;
        _addVault(contractAddress);
        _addMarket(market);

        emit AddedContract(name, contractAddress, false);
    }

    function removeContract(string memory name) external {
        require(!_hasContract(name), "removeContract: Contract does not exist");

        address contractAdress = _contracts[name];
        require(IOwnable(_contracts[name]).getOwner() == msg.sender, "removeContract: Must be the contract owner");

        address market = IVault(contractAddress).getMarket();
        _removeMarket(index, market);
    }

    function _addVault(address vault) private {
        address assetAddress = IERC4626(vault).asset();
        require(_vaultByAsset[assetAddress] == address(0), "addVault: Vault with this asset token already added");

        vaults.push(vault);
        _vaultByAsset[assetAddress] = vault; 
    }

    function _removeVault(uint256 index) private {
        if (index >= vaults.length) return;

        delete _vaultByAsset[vaults[i]];

        for (uint256 i = index; i < vaults.length - 1; i++){
            vaults[i] = vaults[i+1];
        }

        vaults.pop();
    }

    function _addMarket(address market) private {
        require(
            _markets[market] == address(0),
            "addMarket: Market already added"
        );
        _markets[market] = market;
        markets.push(market);
    }

    function _removeMarket(uint256 index) private {
        if (index >= markets.length) return;

        delete _markets[markets[i]];

        for (uint256 i = index; i < markets.length - 1; i++){
            markets[i] = markets[i+1];
        }

        markets.pop();
    }

    function setThreshold(uint256 threshold) external onlyOwner {
        require(threshold != _threshold, "setThreshold: Threshold already set");
        _threshold = threshold;
        emit ThresholdUpdated(threshold);
    }

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
    event AddedContract(string name, address indexed contractAddress, bool isProxy);
    event ContractUpgraded(string name, address indexed contractName);
    event RemovedContract(string name);
}
