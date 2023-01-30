// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./SignatureLib.sol";

// Binary Oracle
interface IOracle {
    struct Result {
        bytes16 winningPropositionId;
        bytes16[] scratchedPropositionIds;
	}

    function checkResult(
        bytes16 marketId,
        bytes16 propositionId
    ) external view returns (uint8);

    function getResult(bytes16 marketId) external view returns (Result memory);

    function setResult(
        bytes16 marketId,
        bytes16 propositionId,
        SignatureLib.Signature calldata signature
    ) external;

	function setScratchedResult(
		bytes16 marketId,
		bytes16 scratchedPropositionId,
		SignatureLib.Signature calldata signature
	) external;

    event ResultSet(bytes16 indexed marketId, bytes16 indexed propositionId);
    event ScratchedSet(bytes16 indexed marketId, bytes16 indexed propositionId);
}