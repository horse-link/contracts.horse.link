// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./Market.sol";
import "./OddsLib.sol";

contract MarketCurved is Market {

    constructor(
        IVault vault,
        uint8 fee,
        address oracle
    ) Market(vault, fee, oracle) {
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