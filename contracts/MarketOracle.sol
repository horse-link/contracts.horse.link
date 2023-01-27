// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./IOracle.sol";
import "./SignatureLib.sol";

contract MarketOracle is IOracle {

	struct Result {
		bytes16 winningPropositionId;
		bytes16[] scratchedPropositionIds;
	}

	// Mapping of marketId => winning propositionId
	mapping(bytes16 => Result) private _results;
	address private immutable _owner;

	// Race result constants
    uint8 public constant WINNER = 0x01;
    uint8 public constant LOSER = 0x02;
    uint8 public constant SCRATCHED = 0x03;

	constructor() {
		_owner = msg.sender;
	}

	function getOwner() external view returns (address) {
		return _owner;
	}

	// Change to return one of the constants
	function checkResult(
		bytes16 marketId,
		bytes16 propositionId
	) external view returns (uint) {
		require(
			propositionId != bytes16(0),
			"getBinaryResult: Invalid propositionId"
		);

		if (_results[marketId].winningPropositionId == propositionId) {
			return WINNER;
		}
		uint256 totalScratched = _results[marketId].scratchedPropositionIds.length;
		for (uint64 i = 0; i < totalScratched ; i++) {
			if (_results[marketId].scratchedPropositionIds[i] == propositionId) {
				return SCRATCHED;
			}
		}

		return LOSER;
	}

	function getResult(bytes16 marketId) external view returns (Result) {
		require(
			marketId != bytes16(0),
			"getBinaryResult: Invalid propositionId"
		);
		return _results[marketId];
	}

	function setResult(
		bytes16 marketId,
		bytes16 winningPropositionId,
		SignatureLib.Signature calldata signature
	) external {
		bytes32 messageHash = keccak256(abi.encodePacked(marketId, winningPropositionId));
		require(
			isValidSignature(messageHash, signature),
			"setResult: Invalid signature"
		);
		require(
			winningPropositionId != bytes16(0),
			"setResult: Invalid propositionId"
		);
		require(
			_results[marketId].winningPropositionId == bytes16(0),
			"setResult: Result already set"
		);
		_results[marketId].winningPropositionId = winningPropositionId;

		emit ResultSet(marketId, winningPropositionId);
	}

	function setScractchedResult(
		bytes16 marketId,
		bytes16 scratchedPropositionId,
		SignatureLib.Signature calldata signature
	) external {
		bytes32 messageHash = keccak256(abi.encodePacked(marketId, scratchedPropositionId));
		require(
			isValidSignature(messageHash, signature),
			"setScractchedResult: Invalid signature"
		);
		require(
			scratchedPropositionId != bytes16(0),
			"setScractchedResult: Invalid propositionId"
		);

		for (uint64 i = 0; i < totalScratched ; i++) {
			if (_results[marketId].scratchedPropositionIds[i] == scratchedPropositionId) {
				revert("setScractchedResult: Result already set")
			}
		}

		_results[marketId].scratchedPropositionId.push(scratchedPropositionId);

		emit ScratchedSet(marketId, scratchedPropositionId);
	}

	function isValidSignature(
		bytes32 messageHash,
		SignatureLib.Signature calldata signature
	) private view returns (bool) {
		address signer = SignatureLib.recoverSigner(messageHash, signature);
		assert(signer != address(0));
		return address(signer) == address(_owner);
	}
}
