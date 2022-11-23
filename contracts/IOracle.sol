// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

// Binary Oracle
interface IOracle {
    function checkResult(
        bytes16 marketId,
        bytes16 propositionId
    ) external view returns (bool);

    function getResult(bytes16 marketId) external view returns (bytes16);

    function setResult(
        bytes16 marketId,
        bytes16 propositionId,
        bytes32 sig
    ) external;

    event ResultSet(bytes16 marketId, bytes16 propositionId);
}