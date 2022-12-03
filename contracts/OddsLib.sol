// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";

library OddsLib {

    uint256 public constant PRECISION = 1e6;

    /*
        * @dev Reduces odds linearly to 0 (when the payout would exceed the free liquidity)
        * @param wager The amount of the wager
        * @param odds The odds of the wager, expressed as a number from 0 to PRECISION
        * @return The new adjusted odds
    */
    function getLinearAdjustedOdds(
        uint256 wager,
        uint256 odds,
        uint256 maxPayout
    ) external pure returns (uint256) {
        uint256 unadjustedPayout = odds * wager / PRECISION;
		uint256 oddsAdjustment = Math.mulDiv(odds, unadjustedPayout, maxPayout, Math.Rounding.Up);
        // If we have gone past the floor, clip to 0
        if (oddsAdjustment > odds) {
            return 0;
        }
        return odds - oddsAdjustment;
    }

    /*
        * @dev Reduces odds on a curve that approaches 0 as the payout increases, such that the payout will always be less then free liquidity. Increase the coefficient to make the curve steeper. 2 is a good starting point.
        * @param wager The amount of the wager
        * @param odds The odds of the wager, expressed as a number from 0 to PRECISION
        * @return The new adjusted odds
    */
    function getCurvedAdjustedOdds(
        uint256 wager,
        uint256 odds,
        uint256 maxPayout
    ) external pure returns (uint256) {
        uint256 SQRT_PRECISION = 1e3;
        uint256 potentialPayout = wager * odds / PRECISION;
        uint256 adjustedPayout = maxPayout -
            (maxPayout * SQRT_PRECISION) /
            Math.sqrt(
                2 * (potentialPayout * PRECISION) / maxPayout + (1 * PRECISION),
                Math.Rounding.Up
            );
        // Return the odds need to generate this adjusted payout with the given wager
        return (adjustedPayout * PRECISION) / wager ;
    }
}