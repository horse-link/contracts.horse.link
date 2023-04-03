// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;

import "./Market.sol";
import "hardhat/console.sol";


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

		// Deduct from total exposure
		_totalExposure -= _betExposure[index];

		if (result == SCRATCHED) {
			// Transfer the bet amount to the owner of the NFT
			IERC20(_vault.asset()).transfer(
				ownerOf(index),
				_bets[index].amount
			);
		} 
		
		address underlying = _vault.asset();
		if (result == WINNER) {
			// Send the payout to the NFT owner
			_totalCollateral -= _betExposure[index];
			IERC20(underlying).transfer(ownerOf(index), _bets[index].payout);
		} else {
			// Else, the bet was a loser
			// Send the bet amount to the vault
			IERC20(underlying).transfer(address(_vault), _bets[index].amount);
		}
	}

	/*function _isMostExpensiveProposition(
		bytes16 propositionId,
		bytes16 marketId
	) internal view returns (bool) {
		return
			keccak256(abi.encodePacked(propositionId)) ==
			keccak256(abi.encodePacked(_mostExpensivePropositionId[marketId]));
	}*/

	// Overidden to make this "collateralised" - it will hold on to the collateral amounts for future bets
	// If the payout for this proposition will be greater than the amount of collateral set aside for the market
	// Return the new exposure amount
	// wager and payout are not required in this implement because the calculation is based on:
	// 1. The amount of collateral already set aside for the market
	// 2. The size of the most expensive proposition in the market
	// 3. The potential payout of this proposition (which already includes the current wager)
	function _obtainCollateral(
		uint256 index,
		bytes16 marketId,
		bytes16 propositionId
	) internal virtual returns (uint256) {
		console.log("MarketCollateralised._obtainCollateral");
		uint256 result;

		uint256 internalCollateralToUse;
		
		// The collateral reserved for this race
		uint256 existingCollateral = _marketCollateral[marketId] + _marketTotal[marketId];
		console.log("_marketCollateral[marketId]", _marketCollateral[marketId]);
		console.log("_marketTotal[marketId]", _marketTotal[marketId]);
		console.log("_potetntialPayout[propositionId]", _potentialPayout[propositionId]);
		
		if (_potentialPayout[propositionId] > existingCollateral) {
			console.log("Collateral required for this bet", _potentialPayout[propositionId] - existingCollateral);

			// Get any additional collateral we need for this race
			_mostExpensivePropositionId[marketId] = propositionId;
			
			// The amount to borrow starts as the difference between the potential payout and the existing collateral on this race
			uint256 amountToBorrow = _potentialPayout[propositionId] - existingCollateral;
			
			// If the total amount of collateral in the contracts is greater than the amount backing bets, we can use some
			if (_totalCollateral > _totalExposure) {
				// We have some collateral available to use (from previous bets
				// The amount of collateral available to use is the total collateral minus the total exposure
				uint256 internallyAvailableCollateral = _totalCollateral - _totalExposure;

				// We can only use the amount of collateral that is available
				internalCollateralToUse = Math.min(result, internallyAvailableCollateral);			
			}

			// If the amount we need to borrow is greater than the amount of collateral we can use, we need to get more collateral from the Vault
			if (internalCollateralToUse < amountToBorrow) {
				// We need to get more collateral from the Vault
				//result = result - internalCollateralToUse;
				amountToBorrow -= internalCollateralToUse;
				IERC20(_vault.asset()).transferFrom(
					address(_vault),
					_self,
					amountToBorrow
				);

				// Add the amount we borrowed to the total collateral				
				emit Borrowed(index, amountToBorrow);
				_totalCollateral += amountToBorrow;
			}
			// Add to the race collateral							
			_marketCollateral[marketId] += amountToBorrow + internalCollateralToUse;
		}
		// Store the amount of exposure that this bet added. This will be deducted from the total exposure when the bet is paid out
		_betExposure[_bets.length] = result;
		return result; // Amount of exposure added by this bet
	}

	function getTotalCollateral() external view returns (uint256) {
		return _totalCollateral;
	}

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
