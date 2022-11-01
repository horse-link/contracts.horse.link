// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

// Binary Oracle
interface IOracle {
    function getBinaryResult(bytes32 id) external returns (bool);
}