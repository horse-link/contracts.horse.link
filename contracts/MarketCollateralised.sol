// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;
import "./Market.sol";

abstract contract MarketCollateralised is Market {
	// MarketID => amount of collateral taken for this market
	mapping(bytes16 => uint256) private _marketCollateral;
	uint256 internal _totalCollateral;
	mapping(bytes16 => bytes16) internal _mostExpensivePropositionId;
	mapping(uint256 => uint256) internal _betExposure;

	function getMarketCollateral(
		bytes16 marketId
	) external view returns (uint256) {
		return _marketCollateral[marketId];
	}

	function _payout(uint256 index, uint8 result) internal override {
		require(
			_bets[index].payoutDate < block.timestamp,
			"_payout: Payout date not reached"
		);
		address underlying = _vault.asset();

		// Deduct from total exposure
		_totalExposure -= _betExposure[index];

		if (result == SCRATCHED) {
			// Transfer the bet amount to the owner of the NFT
			IERC20(_vault.asset()).transfer(
				ownerOf(index),
				_bets[index].amount
			);
		} else if (result == WINNER) {
			// Send the payout to the NFT owner
			_totalCollateral -= _bets[index].payout - _bets[index].amount;
			IERC20(underlying).transfer(ownerOf(index), _bets[index].payout);
		} else {
			// Else, the bet was a loser
			// Send the bet amount to the vault
			IERC20(underlying).transfer(address(_vault), _bets[index].amount);
		}
	}

	function _isMostExpensiveProposition(
		bytes16 propositionId,
		bytes16 marketId
	) internal view returns (bool) {
		return
			keccak256(abi.encodePacked(propositionId)) ==
			keccak256(abi.encodePacked(_mostExpensivePropositionId[marketId]));
	}

	// Overidden to make this "collateralised" - it will hold on to the collateral amounts for future bets
	// If the payout for this proposition will be greater than the amount of collateral set aside for the market
	// Return the new exposure amount
	// wager and payout are not required in this implement because the calculation is based on:
	// 1. The amount of collateral already set aside for the market
	// 2. The size of the most expensive proposition in the market
	// 3. The potential payout of this proposition (which already includes the current wager)
	function _obtainCollateral(
		bytes16 marketId,
		bytes16 propositionId,
		uint256 /*wager*/,
		uint256 /*payout*/
	) internal override returns (uint256) {
		uint256 result;
		uint256 existingCollateral = _marketCollateral[marketId] + _marketTotal[marketId];
		
		if (_potentialPayout[propositionId] > existingCollateral) {
			// Get any additional collateral we need for this market
			_mostExpensivePropositionId[marketId] = propositionId;
			result = _potentialPayout[propositionId] - existingCollateral;
			uint256 internallyAvailableCollateral = _totalCollateral - _totalExposure;
			uint256 internalCollateralToUse = Math.min(result, internallyAvailableCollateral);

			_totalExposure += internalCollateralToUse;
			if (internalCollateralToUse < result) {
				// We need to get more collateral from the Vault
				result = result - internalCollateralToUse;
				IERC20(_vault.asset()).transferFrom(
					address(_vault),
					_self,
					result
				);
				_totalCollateral += result;
			}
			_marketCollateral[marketId] += result;
		}

		_betExposure[_bets.length] = result;
		return result;
	}

	/*function getTotalCollateral() external view returns (uint256) {
		return _totalCollateral;
	}*/

	// Return any unused collateral to the Vault
	function refundCollateral() external onlyOwner {
		require(_totalCollateral > _totalExposure, "refundCollateral: No collateral to refund");
		
		IERC20(_vault.asset()).transfer(
			address(_vault),
			_totalCollateral - _totalExposure
		);
		_totalCollateral = _totalExposure;
	}
}
