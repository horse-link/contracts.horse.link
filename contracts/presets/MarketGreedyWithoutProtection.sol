// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "../MarketWithoutProtection.sol";
import "../MarketGreedy.sol";
import "../Market.sol";

contract MarketGreedyWithoutProtection is MarketGreedy {

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
	) internal view override returns (uint256) {
		return odds;
	}

}