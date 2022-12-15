// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./IVault.sol";
import "./IMarket.sol";
import "./IOracle.sol";
import "./SignatureLib.sol";
import "./OddsLib.sol";
import "./Market.sol";

contract MarketWithRisk is Market {

	function getOddsWithRisk(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 risk
	) external view override returns (uint256) {
		return _getOdds(wager, odds, propositionId, marketId, risk);
	}
}
