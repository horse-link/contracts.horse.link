// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./IOracle.sol";

contract MarketOracle is IOracle {

    mapping (bytes32 => bytes32) private _results;
    address immutable private _owner;

    constructor() {
        _owner = msg.sender;
    }

    function checkResult(bytes32 marketId, bytes32 propositionId) external view returns (bool) {
        require(propositionId != 0x0000000000000000000000000000000000000000000000000000000000000000, "getBinaryResult: Invalid propositionId");
        return _results[marketId] == propositionId;
    }

    function getResult(bytes32 marketId) external view returns (bytes32) {
        require(marketId != 0x0000000000000000000000000000000000000000000000000000000000000000, "getBinaryResult: Invalid propositionId");
        return _results[marketId];
    }

    function setResult(bytes32 marketId, bytes32 propositionId, Signature calldata sig) external {
        require(propositionId != 0x0000000000000000000000000000000000000000000000000000000000000000, "setBinaryResult: Invalid propositionId");
        require(_results[marketId] != 0x0000000000000000000000000000000000000000000000000000000000000000, "setBinaryResult: Invalid propositionId");
        _results[marketId] = propositionId;

        Emit ResultSet(marketId, propositionId);
    }

    modifier onlyMarketOwner(bytes32 messageHash, Signature calldata sig) {
        require(
            recoverSigner(messageHash, sig) == _owner,
            "onlyMarketOwner: Invalid signature"
        );
        _;
    }

    function recoverSigner(bytes32 message, Signature calldata signature)
        private
        pure
        returns (address)
    {
        bytes32 prefixedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", message)
        );
        return ecrecover(prefixedHash, signature.v, signature.r, signature.s);
    }
}
