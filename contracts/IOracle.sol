// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./SignatureLib.sol";

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
        SignatureLib.Signature calldata signature
    ) external;

	function setScractchedResult(
		bytes16 marketId,
		bytes16 scratchedPropositionId,
		SignatureLib.Signature calldata signature
	) external;

    event ResultSet(bytes16 indexed marketId, bytes16 indexed propositionId);
    event ScratchedSet(bytes16 indexed marketId, bytes16 indexed propositionId);
}