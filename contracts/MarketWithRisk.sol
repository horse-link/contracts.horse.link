// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./SignatureLib.sol";
import "./Market.sol";

contract MarketWithRisk is Market {
    constructor(
        address vault,
        uint8 fee,
		uint8 timeoutDays,
        address oracle,
		string memory baseMetadataURI
	) Market(vault, fee, timeoutDays, oracle, baseMetadataURI) {
    }

	function getOddsWithRisk(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 risk
	) external view returns (uint256) {
		return _getOddsWithRisk(wager, odds, propositionId, marketId, risk);
	}

	function _getOddsWithRisk(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 risk
	) private view returns (uint256) {
		return _getOdds(wager, odds, propositionId, marketId) / risk ** 2;
	}

	function backWithRisk(
		bytes16 nonce,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds,
		uint256 close,
		uint256 end,
		uint256 risk,
		SignatureLib.Signature calldata signature
	) external returns (uint256) {
		bytes32 messageHash = keccak256(abi.encodePacked(
			nonce,
			propositionId,
			marketId,
			odds,
			close,
			end,
			risk
		));

		require(isValidSignature(messageHash, signature) == true, "backWithRisk: Invalid signature");

		uint256 payout = wager * _getOddsWithRisk(wager, odds, propositionId, marketId, risk);
		return _back(
			propositionId,
			marketId,
			wager,
			end,
			payout
		);
	}
}
