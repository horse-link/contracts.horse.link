// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
pragma abicoder v2;
import "./Market.sol";

//Import Hardhat console.log
import "hardhat/console.sol";

contract MarketGreedy is Market {
    // MarketID => amount of cover taken for this market
	mapping(bytes16 => uint256) private _marketCover;

    constructor(
        IVault vault,
        uint8 fee,
        address oracle
    ) Market(vault, fee, oracle) {
    }
    
    function getMarketCover(bytes16 marketId) external view returns (uint256) {
		return _marketCover[marketId];
	}

	function _payout(uint256 index, bool result) internal override {
		require(
			_bets[index].payoutDate < block.timestamp,
			"_settle: Payout date not reached"
		);
		address underlying = _vault.asset();

		_totalInPlay -= _bets[index].amount;
		if (result == true) {
			// Send the payout to the bet owner
			IERC20(underlying).transfer(_bets[index].owner, _bets[index].payout);
            _totalCover -= _bets[index].payout - _bets[index].amount;
		} else {
			// Send the bet amount to the vault
			IERC20(underlying).transfer(address(_vault), _bets[index].amount);
		}
        
	}

	// Overriden to make this "greedy" - it will hold on to the cover amounts for future bets
    // If the payout for this proposition will be greater than the amount of cover set aside for the market
	function _obtainCover(bytes16 marketId, bytes16 propositionId, uint256 wager, uint256 payout) internal override returns (uint256) {
        if (_potentialPayout[propositionId] > _marketCover[marketId]) {
			// Get any additional cover we need for this market
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
                _totalCover += amountToTransfer;  
                
            } 
            _marketCover[marketId] += amountRequired;           
		}
	}

	// Allow the Vault to reclaim any cover it has provided, provided it is not currently covering any bets
	function reclaimCover() external onlyOwner {
		IERC20(_vault.asset()).transfer(address(_vault), _totalCover - _totalExposure);
		_totalCover = _totalExposure;
	}

}
