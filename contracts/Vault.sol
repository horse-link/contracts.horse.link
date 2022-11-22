// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "./IMarket.sol";
import "./IVault.sol";

contract Vault is Ownable, IVault, ERC20PresetMinterPauser {
    // ERC20
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    mapping(address => uint256) private _shares;

    IERC20Metadata private immutable _underlying;
    address private immutable _self;
    
    // These will change to allow multiple markets
    address private _market;
    uint8 private immutable _decimals;

    constructor(
        IERC20Metadata underlying
    )
        ERC20PresetMinterPauser(
            string(abi.encodePacked("HL ", underlying.name())),
            string(abi.encodePacked("HL", underlying.symbol()))
        )
    {
        require(
            address(underlying) != address(0),
            "Underlying address is invalid"
        );

        _self = address(this);
        _underlying = underlying;
        _decimals = IERC20Metadata(underlying).decimals();
    }

    // Override decimals to be the same as the underlying asset
    function decimals() public view override(ERC20) returns (uint8) {
        return _decimals;
    }

    function totalSupply()
        public
        view
        override
        returns (uint256)
    {
        return _totalSupply;
    }

    function getMarketAllowance() external view returns (uint256) {
        // // TODO: This will change to allow multiple markets, using msg.sender
        uint256 allowance = _underlying.allowance(_self, _market);
        if (allowance > _totalAssets()) {
            return _totalAssets();
        }
        
        return allowance;
    }

    function getMarket() external view returns (address) {
        return _market;
    }

    function setMarket(address market, uint256 max) public onlyOwner {
        require(_market == address(0), "setMarket: Market already set");

        _market = market;

        _underlying.approve(_market, max);
    }

    function getPerformance() external view returns (uint256) {
        return _getPerformance();
    }

    function _getPerformance() private view returns (uint256) {
        uint256 underlyingBalance = _underlying.balanceOf(_self);
        if (underlyingBalance > 0)
            return (_totalSupply * 100) / underlyingBalance;

        return 0;
    }

    function convertToAssets(
        uint256 shares
    ) external view returns (uint256 assets) {
        return _convertToAssets(shares);
    }

    function _convertToAssets(
        uint256 shares
    ) private view returns (uint256 assets) {
        uint256 inPlay = _underlying.balanceOf(_market);

        assets = shares / (_totalAssets() - inPlay);
    }

    function convertToShares(
        uint256 assets
    ) external view returns (uint256 shares) {
        return _convertToShares(assets);
    }

    function _convertToShares(
        uint256 assets
    ) private view returns (uint256 shares) {
        if (_totalAssets() == 0) {
            shares = assets;
        } else {
            shares = (assets * _totalSupply) / _totalAssets();
        }
    }

    // IERC4626
    function asset() external view returns (address) {
        return address(_underlying);
    }

    // Total amounts of assets held in the vault
    function totalAssets() external view returns (uint256) {
        return _totalAssets();
    }

    function _totalAssets() private view returns (uint256) {
        return _underlying.balanceOf(_self);
    }

    // Add underlying tokens to the pool
    function deposit(
        uint256 assets,
        address receiver
    ) external withMarket returns (uint256 shares) {
        require(assets > 0, "deposit: Value must be greater than 0");

        if (receiver == address(0)) receiver = _msgSender();

        shares = _convertToShares(assets);
        _mint(receiver, shares);
        _totalSupply += shares;
        _balances[msg.sender] += shares;

        _underlying.transferFrom(receiver, _self, assets);

        emit Deposit(receiver, assets);
    }

    function maxWithdraw(
        address owner
    ) external view returns (uint256 maxAssets) {
        maxAssets = _balances[owner];
    }

    function previewWithdraw(
        uint256 assets
    ) external view returns (uint256 shares) {
        shares = _previewWithdraw(assets);
    }

    function _previewWithdraw(uint256 assets) private view returns (uint256) {
        uint256 underlyingBalance = _underlying.balanceOf(
            _self
        );
        uint256 inPlay = _underlying.balanceOf(_market);

        return (assets * underlyingBalance) / (underlyingBalance + inPlay);
    }

    // Exit your position
    function withdraw(uint256 shares) external {
        uint256 balance = _balances[msg.sender];
        require(balance >= shares, "withdraw: You do not have enough shares");

        uint256 amount = _previewWithdraw(shares);
        _totalSupply -= amount;
        _balances[msg.sender] -= shares;
        _burn(msg.sender, shares);

        _underlying.transfer(msg.sender, amount);

        emit Withdraw(msg.sender, balance);
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
