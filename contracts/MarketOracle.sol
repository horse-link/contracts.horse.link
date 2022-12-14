// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./IOracle.sol";
import "./SignatureLib.sol";

contract MarketOracle is IOracle {
    mapping(bytes16 => bytes16) private _results;
    address private immutable _owner;

    constructor() {
        _owner = msg.sender;
    }

    function getOwner() external view returns (address) {
        return _owner;
    }

    function checkResult(
        bytes16 marketId,
        bytes16 propositionId
    ) external view returns (bool) {
        require(
            propositionId != bytes16(0),
            "getBinaryResult: Invalid propositionId"
        );
        return _results[marketId] == propositionId;
    }

    function getResult(bytes16 marketId) external view returns (bytes16) {
        require(
            marketId != bytes16(0),
            "getBinaryResult: Invalid propositionId"
        );
        return _results[marketId];
    }

    function getSetResultMessage(
        bytes16 marketId,
        bytes16 propositionId
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(marketId, propositionId));
    }

    function setResult(
        bytes16 marketId,
        bytes16 propositionId,
        SignatureLib.Signature calldata signature
    ) external {
        bytes32 messageHash = getSetResultMessage(marketId, propositionId);
        require(isValidSignature(messageHash, signature), "setBinaryResult: Invalid signature");
        require(
            propositionId != bytes16(0),
            "setBinaryResult: Invalid propositionId"
        );
        require(
            _results[marketId] == bytes16(0),
            "setBinaryResult: Result already set"
        );
        _results[marketId] = propositionId;

        emit ResultSet(marketId, propositionId);
    }

    function isValidSignature(bytes32 messageHash, SignatureLib.Signature calldata signature) private view returns (bool) {
		address signer = SignatureLib.recoverSigner(messageHash, signature);
		assert(signer != address(0));
		return address(signer) == address(_owner);
	}
}
