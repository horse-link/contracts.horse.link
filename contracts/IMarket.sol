// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./SignatureLib.sol";

interface IMarket {
	function getFee() external view returns (uint8);

	function getTotalInPlay() external view returns (uint256);

	function getInPlayCount() external view returns (uint256);

	function getTotalExposure() external view returns (uint256);

	function getBetByIndex(uint256 index)
		external
		view
		returns (
			uint256,
			uint256,
			uint256,
			bool,
			address
		);

	function getOdds(
		int256 wager,
		int256 odds,
		bytes16 propositionId
	) external view returns (int256);

	function getOracleAddress() external view returns (address);

	function getPotentialPayout(
		bytes16 propositionId,
		uint256 wager,
		uint256 odds
	) external view returns (uint256);

	function getVaultAddress() external view returns (address);

	function back(
		bytes16 nonce,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds,
		uint256 close,
		uint256 end,
		SignatureLib.Signature calldata sig
	) external returns (uint256);

	function settle(uint256 index) external;
}
