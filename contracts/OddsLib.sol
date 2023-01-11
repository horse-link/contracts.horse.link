// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";

library OddsLib {

    uint256 public constant PRECISION = 1e6;

    /*
        * @dev Adjust the odds downwards linearly to 1
        * @param wager The amount wagered
        * @param pool The total amount in the pool
        * @return The adjusted decimal odds given
    */
    function getLinearAdjustedOdds(
        uint256 wager,
        uint256 odds,
        uint256 liquidity
    ) external pure returns (uint256) {
        assert(odds >= 1 * PRECISION);
        uint256 unadjustedPayout = odds * wager / PRECISION;
		uint256 oddsAdjustment = Math.mulDiv(odds, unadjustedPayout, liquidity + wager, Math.Rounding.Down);
        // If we have gone past the floor, clip to 1
        if (oddsAdjustment > odds) {
            return 1 * PRECISION;
        }
        return Math.max(1 * PRECISION, odds - oddsAdjustment);
    }

    /*
        * @dev Reduces odds on a curve that approaches 0 as the payout increases, such that the payout will always be less then free liquidity. Increase the coefficient to make the curve steeper. 2 is a good starting point.
        * @param wager The amount of the wager
        * @param odds The decimals odds of the wager, expressed as a number
        * @return The new adjusted decimal odds
    */
    function getCurvedAdjustedOdds(
        uint256 wager,
        uint256 odds,
        uint256 liquidity
    ) external pure returns (uint256) {
        assert(odds >= 1 * PRECISION);
        uint256 SQRT_PRECISION = 1e3;
        uint256 potentialPayout = (wager * odds / PRECISION);
        uint256 adjustedPayout = (liquidity + wager) -
            (liquidity * SQRT_PRECISION) /
            Math.sqrt(
                2 * (potentialPayout * PRECISION) / liquidity + (1 * PRECISION),
                Math.Rounding.Up
            );
        // Return the odds need to generate this adjusted payout with the given wager
        return Math.max(1 * PRECISION, (adjustedPayout * PRECISION) / wager);
    }
}