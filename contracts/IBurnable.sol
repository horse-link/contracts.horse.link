// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

// Horse.Link oracle interface
interface IBurnable {
    function burnFrom(address from, uint256 amount) external;
}