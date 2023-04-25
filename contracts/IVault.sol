// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./IOwnable.sol";

interface IVault is IOwnable {
    function getMarket() external view returns (address);
    function getMarketAllowance() external view returns (uint256);
    function getPerformance() external view returns (uint256);
    function getRate() external view returns (uint256);
    function removeMarket() external;
    function setMarket(address market, uint256 max, uint256 rate) external;
    function totalAssetsLocked() external view returns (uint256);
}
