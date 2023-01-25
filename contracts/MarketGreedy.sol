// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;
import "./Market.sol";

abstract contract MarketGreedy is Market {
    // MarketID => amount of collateral taken for this market
	mapping(bytes16 => uint256) private _marketCollateral;
	uint256 internal _totalCollateral;
	mapping(bytes16 => bytes16) internal _mostExpensivePropositionId;

    function getMarketCollateral(bytes16 marketId) external view returns (uint256) {
		return _marketCollateral[marketId];
	}

	function _payout(uint256 index, bool result) internal override {
		require(
			_bets[index].payoutDate < block.timestamp,
			"_payout: Payout date not reached"
		);
		address underlying = _vault.asset();

		//_totalInPlay -= _bets[index].amount;
		if (result == true) {
			// Send the payout to the bet owner
			IERC20(underlying).transfer(_bets[index].owner, _bets[index].payout);
			_totalCollateral -= _bets[index].payout - _bets[index].amount;  
		} else {
			// Send the bet amount to the vault
			IERC20(underlying).transfer(address(_vault), _bets[index].amount);	
		}

		//If paying out the most expensive proposition,
		if (isMostExpensiveProposition(_bets[index].propositionId, _bets[index].marketId)) {
			// Deduct from total exposure
			_totalExposure -= (_bets[index].payout - _bets[index].amount);
		}
	}

	function isMostExpensiveProposition(bytes16 propositionId, bytes16 marketId) internal view returns (bool) {
		return keccak256(abi.encodePacked(propositionId)) == keccak256(abi.encodePacked(_mostExpensivePropositionId[marketId]));
	}

	// Overidden to make this "greedy" - it will hold on to the collateral amounts for future bets
    // If the payout for this proposition will be greater than the amount of collateral set aside for the market
	// Return the new exposure amount
	function _obtainCollateral(bytes16 marketId, bytes16 propositionId, uint256 wager, uint256 payout) internal override returns (uint256) {
		uint256 result;
		if (_potentialPayout[propositionId] > _marketCollateral[marketId]) {
			// Get any additional collateral we need for this market
			_mostExpensivePropositionId[marketId] = propositionId;
			uint256 amountRequired =_potentialPayout[propositionId] - _marketCollateral[marketId];
            uint256 internallyAvailableCollateral = _totalCollateral - _totalExposure;
            uint256 internalCollateralToUse = Math.min(amountRequired, internallyAvailableCollateral);
                    
            if (internalCollateralToUse < amountRequired) {
                // We need to get more collateral from the Vault 
                uint256 amountToTransfer = amountRequired - internalCollateralToUse;     
                IERC20(_vault.asset()).transferFrom(
                    address(_vault),
                    _self,
                    amountToTransfer
                ); 
                result = amountToTransfer;
				_totalCollateral += result;
            } else {
				result = amountRequired;
			}
            _marketCollateral[marketId] += amountRequired;     
		}
		return result;
	}

	function getTotalCollateral() external view returns (uint256) {
		return _totalCollateral;
	}

	// Return any unused collateral to the Vault
	function returnCollateral() external onlyOwner {
		if (_totalCollateral > _totalExposure) {
			_totalCollateral = _totalExposure;
			IERC20(_vault.asset()).transfer(address(_vault), _totalCollateral - _totalExposure);		
		}
	}
}
