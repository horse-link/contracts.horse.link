// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

interface IRewards {
    function disburse(address to, uint256 amount) external;
}