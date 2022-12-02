// SPDX-Licence: MIT
pragma solidity =0.8.10;
import "./Market.sol";
contract MarketCurved is Market {

    function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal override view returns (uint256) {
		return OddsLib.getCurvedAdjustedOdds(
			wager,
			odds,
			pool,
            2
		);
	}
}