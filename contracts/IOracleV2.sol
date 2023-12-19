// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./SignatureLib.sol";

// Oracle
interface IOracleV2 {
    struct Result {
        uint64 winningPrediction;
	}

    function hasResult(bytes16 marketId) external view returns (bool);

    function checkResult(
        bytes16 marketId,
        uint64 prediction
    ) external view returns (uint8);

    function getResult(bytes16 marketId) external view returns (Result memory);

    function setResult(
        bytes16 marketId,
        bytes16 propositionId,
        SignatureLib.Signature calldata signature
    ) external;

	function setScratchedResult(
		bytes16 marketId,
		bytes16 propositionId,
        uint256 odds,
		SignatureLib.Signature calldata signature
	) external;

    event ResultSet(bytes16 indexed marketId, bytes16 indexed propositionId);
    event ScratchedSet(bytes16 indexed marketId, bytes16 indexed propositionId);
}