// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "./Market.sol";
import "./OddsLib.sol";

abstract contract MarketWithoutProtection is Market {

	function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal view override returns (uint256) {
		return odds;
	}
}