// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

interface IVault {
    function join() external;
    function exit() external;
    function rebalance() external;
}
