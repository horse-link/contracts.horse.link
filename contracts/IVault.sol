// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

interface IVault is IERC20Metadata {
    function asset() external view returns (IERC20Metadata assetTokenAddress);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function getPerformance() external view returns (uint256);
    function setMarket(address market, uint256 max) external;
    function totalAssets() external view returns (uint256);
    function withdraw(uint256 shares) external;

    event Deposit(address indexed who, uint256 value);
    event Withdraw(address indexed who, uint256 value);
}