// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IVault is IERC20Metadata, IERC4626 {
    function getPerformance() external view returns (uint256);
    function setMarket(address market, uint256 max) external;
}
