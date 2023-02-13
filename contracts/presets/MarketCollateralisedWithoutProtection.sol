// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "../MarketWithoutProtection.sol";
import "../MarketCollateralised.sol";
import "../Market.sol";

contract MarketCollateralisedWithoutProtection is MarketCollateralised {

    constructor(
        IVault vault,
        uint8 fee,
        uint8 timeoutDays,
        address oracle
    ) Market(vault, fee, timeoutDays, oracle) {
    }

    function _getAdjustedOdds(
		uint256 /*wager*/,
		uint256 odds,
		uint256 /*pool*/
	) internal pure override returns (uint256) {
		return odds;
	}

}