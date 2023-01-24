// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;
import "./Market.sol";

abstract contract MarketGreedy is Market {
    // MarketID => amount of cover taken for this market
	mapping(bytes16 => uint256) private _marketCover;
	uint256 internal _totalCover;
	mapping(bytes16 => bytes16) internal _mostExpensivePropositionId;

    function getMarketCover(bytes16 marketId) external view returns (uint256) {
		return _marketCover[marketId];
	}

	//TODO: Should return the dedection to total exposure to be 
	function _payout(uint256 index, bool result) internal override {
		require(
			_bets[index].payoutDate < block.timestamp,
			"_settle: Payout date not reached"
		);
		address underlying = _vault.asset();

		//_totalInPlay -= _bets[index].amount;
		if (result == true) {
			// Send the payout to the bet owner
			IERC20(underlying).transfer(_bets[index].owner, _bets[index].payout);
			_totalCover -= _bets[index].payout - _bets[index].amount;  
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

	// Overridden to make this "greedy" - it will hold on to the cover amounts for future bets
    // If the payout for this proposition will be greater than the amount of cover set aside for the market
	// Return the new exposure amount
	function _obtainCover(bytes16 marketId, bytes16 propositionId, uint256 wager, uint256 payout) internal override returns (uint256) {
		uint256 result = 0;
		if (_potentialPayout[propositionId] > _marketCover[marketId]) {
			// Get any additional cover we need for this market
			_mostExpensivePropositionId[marketId] = propositionId;
			uint256 amountRequired =_potentialPayout[propositionId] - _marketCover[marketId];
            uint256 internallyAvailableCover = _totalCover - _totalExposure;
            uint256 internalCoverToUse = Math.min(amountRequired, internallyAvailableCover);
                    
            if (internalCoverToUse < amountRequired) {
                // We need to get more cover from the Vault 
                uint256 amountToTransfer = amountRequired - internalCoverToUse;     
                IERC20(_vault.asset()).transferFrom(
                    address(_vault),
                    _self,
                    amountToTransfer
                ); 
                result = amountToTransfer;
				_totalCover += result;
            } else {
				result = amountRequired;
			}
            _marketCover[marketId] += amountRequired;     
		}
		
		//console.log("_totalCover now: %s", _totalCover);
		//console.log("_obtainCover() end");
		return result;
	}

	function getTotalCover() external view returns (uint256) {
		return _totalCover;
	}

	// Allow the Vault to reclaim any cover it has provided, provided it is not currently covering any bets
	function reclaimCover() external onlyOwner {
		if (_totalCover > _totalExposure) {
			IERC20(_vault.asset()).transfer(address(_vault), _totalCover - _totalExposure);
			_totalCover = _totalExposure;		
		}
	}
}
