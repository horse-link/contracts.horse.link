// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;
import "./Market.sol";

//Import Hardhat console.log
import "hardhat/console.sol";

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
		} else {
			// Send the bet amount to the vault
			IERC20(underlying).transfer(address(_vault), _bets[index].amount);
			uint256 cover = _bets[index].payout - _bets[index].amount;
			if (_marketCover[_bets[index].marketId] >= cover) {
				_marketCover[_bets[index].marketId] -= cover;
			} else {
				//_totalExposure -= _marketCover[_bets[index].marketId];
				_marketCover[_bets[index].marketId] = 0;
			}		
		}

		//If paying out the most expensive proposition,
		if (isMostExpensiveProposition(_bets[index].propositionId, _bets[index].marketId)) {
			console.log("*** Paying out the most expensive proposition");
			// Deduct from total exposure
			_totalExposure -= (_bets[index].payout - _bets[index].amount);
		} else {
			console.log("*** Not paying out the most expensive proposition");
		}
        
	}

	function isMostExpensiveProposition(bytes16 propositionId, bytes16 marketId) internal view returns (bool) {
		//console.log("Most expensive:");
		//console.logBytes16(_mostExpensivePropositionId);
		//console.log("Proposition:");
		//console.logBytes16(propositionId);
		bytes16 mostExpensivePropositionId = _mostExpensivePropositionId[marketId];
		return keccak256(abi.encodePacked(propositionId)) == keccak256(abi.encodePacked(mostExpensivePropositionId));
	}

	// Overridden to make this "greedy" - it will hold on to the cover amounts for future bets
    // If the payout for this proposition will be greater than the amount of cover set aside for the market
	// Return the new exposure amount
	function _obtainCover(bytes16 marketId, bytes16 propositionId, uint256 wager, uint256 payout) internal override returns (uint256) {
        console.log("_obtainCover() start: _payout: %s", payout);
		uint256 result = 0;
		console.log("_potentialPayout[propositionId]: %s", _potentialPayout[propositionId]);
		console.log("_marketCover[marketId]: %s", _marketCover[marketId]);
		if (_potentialPayout[propositionId] > _marketCover[marketId]) {
			// Get any additional cover we need for this market
			_mostExpensivePropositionId[marketId] = propositionId;
			//console.log("New most expensive proposition: ");
			//console.logBytes16(_mostExpensivePropositionId);

			uint256 amountRequired =_potentialPayout[propositionId] - _marketCover[marketId];
			//console.log("amountRequired: %s", amountRequired);

			//assert(_totalCover >= _totalExposure);
			//console.log("_totalCover: %s", _totalCover);
			//console.log("_totalExposure: %s", _totalExposure);
            uint256 internallyAvailableCover = _totalCover - _totalExposure;
			//console.log("internallyAvailableCover: %s", internallyAvailableCover);

            uint256 internalCoverToUse = Math.min(amountRequired, internallyAvailableCover);
			//console.log("internalCoverToUse: %s", internalCoverToUse);
                    
            if (internalCoverToUse < amountRequired) {
                // We need to get more cover from the Vault 
				//console.log("Getting more cover from the Vault");
                uint256 amountToTransfer = amountRequired - internalCoverToUse;   
				console.log("amountToTransfer: %s", amountToTransfer);        
                IERC20(_vault.asset()).transferFrom(
                    address(_vault),
                    _self,
                    amountToTransfer
                ); 
				//console.log("Cover obtained from the Vault");
                result = amountToTransfer;
				_totalCover += result;
            } else {
				result = amountRequired;
			}
            _marketCover[marketId] += amountRequired;   
			console.log("_marketCover[marketId] now: %s", _marketCover[marketId]);    
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
