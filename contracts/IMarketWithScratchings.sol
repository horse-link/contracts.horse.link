// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./SignatureLib.sol";

interface IMarketWithScratchings {
	function scratchAndRefund(uint64 index, bytes16 marketId, bytes16 propositionId, uint256 odds, SignatureLib.Signature calldata signature) external;
}