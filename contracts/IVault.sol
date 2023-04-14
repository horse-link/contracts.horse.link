// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./IOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IVault is IOwnable, IERC20Metadata, IERC4626 {
    
    function getMarket() external view returns (address);
    function getMarketAllowance() external view returns (uint256);
    function getOwner() external view returns (address);
    function getPerformance() external view returns (uint256);
    function getRate() external view returns (uint256);
    function setMarket(address market, uint256 max) external;
    function totalAssetsLocked() external view returns (uint256);
}
