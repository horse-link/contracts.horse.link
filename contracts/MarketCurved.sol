// SPDX-Licence: MIT
pragma solidity =0.8.10;
import "./Market.sol";
import "./OddsLib.sol";
contract MarketCurved is Market {

    constructor(
        IVault vault,
        uint8 fee,
        address oracle,
        uint256 coefficient
    ) Market(vault, fee, oracle) {
        _coefficient = coefficient;
    }

    uint256 private _coefficient;

    function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal override view returns (uint256) {
		return OddsLib.getCurvedAdjustedOdds(
			wager,
			odds,
			pool
		);
	}
}