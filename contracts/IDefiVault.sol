// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

interface IVault {
    function join() external;
    function exit() external;
    function rebalance() external;
    function lpBalance() external view returns (uint256);
    function lpToken() external view returns (address);
}
