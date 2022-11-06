// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

// Binary Oracle
interface IOracle {
    function checkResult(bytes32 marketId, bytes32 propositionId) external view returns (bool);
    function getResult(bytes32 marketId) external view returns (bytes32);
    function setResult(bytes32 marketId, bytes32 propositionId, bytes32 sig) external;

    event ResultSet(bytes32 marketId, bytes32 propositionId);
}
