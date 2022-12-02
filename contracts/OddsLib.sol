// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/utils/math/Math.sol";

library OddsLib {

    uint256 internal constant PRECISION = 1 ether;

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
    ) internal pure returns (uint256) {
		uint256 oddsAdjustment = Math.mulDiv(odds, odds * wager, maxPayout, Math.Rounding.Up);
        // If we have gone past the floor, clip to 0
        if (oddsAdjustment > odds) {
            return 0;
        }
        return odds - oddsAdjustment;
    }

    function getLinearAdjustedOdds2(
        uint256 wager,
        uint256 odds,
        uint256 maxPayout
    ) internal pure returns (uint256) {

        uint256 unadjustedPayout = odds * wager;
        uint256 payoutAdjustment = Math.mulDiv(unadjustedPayout, unadjustedPayout, maxPayout, Math.Rounding.Up);
        if (payoutAdjustment > unadjustedPayout) {
            return 0;
        }
        return (unadjustedPayout - payoutAdjustment) * PRECISION / wager * PRECISION;
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
        uint256 maxPayout,
        uint256 coefficient
    ) internal pure returns (uint256) {
        uint256 SQRT_PRECISION = 1e9;
        uint256 potentialPayout = wager * odds * PRECISION;
        uint256 adjustedPayout = maxPayout -
            (maxPayout * SQRT_PRECISION) /
            Math.sqrt(
                coefficient * potentialPayout * PRECISION / maxPayout + (1 * PRECISION),
                Math.Rounding.Up
            );
        // Return the odds need to generate this adjusted payout with the given wager
        return (adjustedPayout * PRECISION) / (wager * PRECISION);
    }
}