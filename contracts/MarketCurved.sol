// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./Market.sol";
import "./OddsLib.sol";

abstract contract MarketCurved is Market {

    constructor(
        IVault vault,
        uint8 fee,
		uint8 timeoutDays,
        address oracle
    ) Market(vault, fee, timeoutDays, oracle) {
    }

    function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal override pure returns (uint256) {
		return OddsLib.getCurvedAdjustedOdds(
			wager,
			odds,
			pool
		);
	}
}