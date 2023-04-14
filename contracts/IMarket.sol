// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./IOwnable.sol";
import "./SignatureLib.sol";

interface IMarket is IOwnable {
	struct Back {
		bytes16 nonce;
		bytes16 propositionId;
		bytes16 marketId;
		uint256 wager;
		uint256 odds;
		uint256 close;
		uint256 end;
		SignatureLib.Signature signature;
	}

	function getCount() external view returns (uint64);
	function getInPlayCount() external view returns (uint256);
	function getMargin() external view returns (uint8);
	function getOwner() external view returns (address);
	function getTotalInPlay() external view returns (uint256);
	function getTotalExposure() external view returns (uint256);

	function getBetByIndex(uint64 index)
		external
		view
		returns (
			uint256,
			uint256,
			uint256,
			uint256,
			bool,
			bytes16,
			bytes16
		);

	function getOdds(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId
	) external view returns (uint256);

	function getOracleAddress() external view returns (address);

	function getPotentialPayout(
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds
	) external view returns (uint256);

	function getVaultAddress() external view returns (address);

	function back(
		Back calldata backData
	) external returns (uint256);

	function settle(uint64 index) external;
	function settleMarket(bytes16 marketId) external;
	// function refundWithSignature(uint64 index, SignatureLib.Signature calldata signature) external;
	function refund(uint64 index) external;
}
