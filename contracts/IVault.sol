// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

interface IVault {
    function asset() external view returns (address);

    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256 shares);

    function getPerformance() external view returns (uint256);

    function getMarket() external view returns (address);
    function getMarketAllowance() external view returns (uint256);
    function setMarket(address market, uint256 max) external;

    function totalAssets() external view returns (uint256);

    function withdraw(uint256 shares) external;

    event Deposit(address indexed who, uint256 value);
    event Withdraw(address indexed who, uint256 value);
}
