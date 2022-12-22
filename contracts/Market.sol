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

// import console log
import "hardhat/console.sol";

// Put these in the ERC721 contract
struct Bet {
	bytes16 propositionId;
	bytes16 marketId;
	uint256 amount;
	uint256 payout;
	uint256 payoutDate;
	bool settled;
	address owner;
}

contract Market is IMarket, Ownable, ERC721 {
	uint8 private immutable _margin;
	IVault private immutable _vault;
	address private immutable _self;
	IOracle private immutable _oracle;

	uint256 private _inplayCount; // running count of bets
	Bet[] private _bets;

	// MarketID => Bets Indexes
	mapping(bytes16 => uint64[]) private _marketBets;

	// MarketID => amount bet
	mapping(bytes16 => uint256) private _marketTotal;

	// MarketID => PropositionID => amount bet
	mapping(bytes16 => mapping(uint16 => uint256)) private _marketBetAmount;

	// PropositionID => amount bet
	mapping(bytes16 => uint256) private _potentialPayout;

	uint256 private _totalInPlay;
	uint256 private _totalExposure;

	// Can claim after this period regardless
	uint256 public immutable timeout;
	uint256 public immutable min;

	mapping(address => bool) private _signers;

	constructor(
		IVault vault,
		uint8 margin,
		address oracle
	)
	ERC721("Horse Link Bet Slip", "HL-BET") {
		assert(address(vault) != address(0));
		_self = address(this);
		_vault = vault;
		_margin = margin;
		_oracle = IOracle(oracle);
		_signers[owner()] = true;

		timeout = 30 days;
		min = 1 hours;
	}

	function tokenURI(uint256 tokenId) public pure override returns (string memory) {
		return string(abi.encodePacked("https://api.horse.link/bet/", tokenId));
	}

	function getMargin() external view returns (uint8) {
		return _margin;
	}

	function getTotalInPlay() external view returns (uint256) {
		return _totalInPlay;
	}

	function getInPlayCount() external view returns (uint256) {
		return _inplayCount;
	}

	function getCount() external view returns (uint64) {
		return _getCount();
	}

	function _getCount() private view returns (uint64) {
		return uint64(_bets.length);
	}

	function getTotalExposure() external view returns (uint256) {
		return _totalExposure;
	}

	function getOracleAddress() external view returns (address) {
		return address(_oracle);
	}

	function getVaultAddress() external view returns (address) {
		return address(_vault);
	}

	function getExpiry(uint64 index) external view returns (uint256) {
		return _getExpiry(index);
	}

	function getMarketTotal(bytes16 marketId) external view returns (uint256) {
		return _marketTotal[marketId];
	}

	function _getExpiry(uint64 index) private view returns (uint256) {
		return _bets[index].payoutDate + timeout;
	}

	function getBetByIndex(uint64 index)
		external
		view
		returns (
			uint256,
			uint256,
			uint256, // payoutDate
			bool,
			address,
			bytes16, // marketId
			bytes16 // propositionId
		)
	{
		return _getBet(index);
	}

	function _getBet(uint64 index)
		private
		view
		returns (
			uint256,
			uint256,
			uint256,
			bool,
			address,
			bytes16,
			bytes16
		)
	{
		Bet memory bet = _bets[index];
		return (bet.amount, bet.payout, bet.payoutDate, bet.settled, bet.owner, bet.marketId, bet.propositionId);
	}

	function getOdds(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId
	) external view override returns (uint256) {
		return _getOdds(wager, odds, propositionId, marketId);
	}

	// Given decimal ("European") odds expressed as the amount one wins for ever unit wagered.
	// This number represents the to total payout rather than the profit, i.e it includes the return of ther stake.
	// Hence, these odds will never go below 1, which represents even money.
	function _getOdds(
		uint256 wager,
		uint256 odds,
		bytes16 propositionId,
		bytes16 marketId
	) internal view returns (uint256) {
		if (wager <= 1 || odds <= 1) return 1;

        uint256 pool = _vault.getMarketAllowance();
        
		// If the pool is not sufficient to cover a new bet for this proposition
		if (pool == 0) return 1;

		// exclude the current total potential payout from the pool
		if (_potentialPayout[propositionId] > pool) {
			return 1;
		}

		pool -= _potentialPayout[propositionId]; 

		// Calculate the new odds
		uint256 adjustedOdds = _getAdjustedOdds(wager, odds, pool);

		return adjustedOdds;
	}

	function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal virtual view returns (uint256) {
		return OddsLib.getLinearAdjustedOdds(
			wager,
			odds,
			pool
		);
	}

	function getPotentialPayout(
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds
	) external view returns (uint256) {
		return _getPayout(propositionId, marketId, wager, odds);
	}

	function _getPayout(
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds
	) private view returns (uint256) {
		uint256 trueOdds = _getOdds(wager, odds, propositionId, marketId);
		return Math.max(wager, (trueOdds * wager) / OddsLib.PRECISION);
	}

	function back(
		bytes16 nonce,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 odds,
		uint256 close,
		uint256 end,
		SignatureLib.Signature calldata signature
	) external returns (uint256) {

		bytes32 messageHash = keccak256(abi.encodePacked(
			nonce,
			propositionId,
			marketId,
			odds,
			close,
			end
		));

		require(isValidSignature(messageHash, signature) == true, "back: Invalid signature");

		// add underlying to the market
		uint256 payout = _getPayout(propositionId, marketId, wager, odds);
		assert(payout > 0);

		return _back(
			propositionId,
			marketId,
			wager,
			close,
			end,
			payout
		);
	}

	function _back(
		bytes16 propositionId,
		bytes16 marketId,
		uint256 wager,
		uint256 close,
		uint256 end,
		uint256 payout
	) internal returns (uint256) {
		require(
			end > block.timestamp && block.timestamp > close,
			"back: Invalid date"
		);

		// Do not allow a bet placed if we know the result
		require(
			IOracle(_oracle).checkResult(marketId, propositionId) == false,
			"back: Oracle result already set for this market"
		);

        address underlying = _vault.asset();

        // escrow
        IERC20(underlying).transferFrom(_msgSender(), _self, wager);
        IERC20(underlying).transferFrom(address(_vault), _self, (payout - wager));

		// add to in play total for this marketId
		_marketTotal[marketId] += wager;

		// add to the total potential payout for this proposition
		_potentialPayout[propositionId] += payout;

		console.log(_getCount());

		_bets.push(
			Bet(propositionId, marketId, wager, payout, end, false, _msgSender())
		);

		console.log(_getCount());

		// use _getCount() to avoid stack too deep
		_marketBets[marketId].push(_getCount());
		_mint(_msgSender(), _getCount() - 1);

		_totalInPlay += wager;
		_totalExposure += (payout - wager);
		_inplayCount++;

		emit Placed(_getCount() - 1, propositionId, marketId, wager, payout, _msgSender());

		return _getCount() - 1;
	}

	function settle(uint64 index) external {
		Bet memory bet = _bets[index];
		require(bet.settled == false, "settle: Bet has already settled");

		_settle(index);
	}

	function _settle(uint64 index) internal {
		_bets[index].settled = true;

		if (block.timestamp > _getExpiry(index)) {
			_payout(index, true);
			return;
		}

		Bet memory bet = _bets[index];
		bool result = IOracle(_oracle).checkResult(
			bet.marketId,
			bet.propositionId
		);

		_payout(index, result);
	}

	function _payout(uint256 index, bool result) private {
		require(
			_bets[index].payoutDate < block.timestamp,
			"_settle: Payout date not reached"
		);

        _totalInPlay -= _bets[index].amount;
        _totalExposure -= _bets[index].payout - _bets[index].amount;
        _inplayCount --;

        address underlying = _vault.asset();
		address recipient = _bets[index].owner;

        if (result == false) {
            // Transfer the proceeds to the vault, less market margin
            recipient = address(_vault);
        }

		IERC20(underlying).transfer(recipient, _bets[index].payout);
		_burn(index);

		emit Settled(index, _bets[index].payout, result, recipient);
	}

	function settleMarket(bytes16 marketId) external {
		// uint64[] memory bets = _marketBets[marketId];

		uint256 total = _marketBets[marketId].length;
		console.log("total", total);

		for (uint64 i = 0; i < total; i++) {
			uint64 index = _marketBets[marketId][i];

			console.log("index", index);

			Bet memory bet = _bets[index];
			if (bet.settled == false) {
				_settle(index);
			}
		}
	}

	function grantSigner(address signer) external onlyOwner {
		require(signer != address(0), "grantSigner: Invalid signer address");
		_signers[signer] = true;
	}

	function revokeSigner(address signer) external onlyOwner {
		require(signer != address(0), "revokeSigner: Invalid signer address");
		_signers[signer] = false;
	}

	function isSigner(address signer) external view returns (bool) {
		return _isSigner(signer);
	}

	function _isSigner(address signer) internal view returns (bool) {
		return _signers[signer];
	}

	function isValidSignature(bytes32 messageHash, SignatureLib.Signature calldata signature) internal view returns (bool) {
		address signer = SignatureLib.recoverSigner(messageHash, signature);
		assert(signer != address(0));
		return _isSigner(signer);
	}

	event Placed(
		uint256 index,
		bytes16 propositionId,
		bytes16 marketId,
		uint256 amount,
		uint256 payout,
		address indexed owner
	);

	event Settled(
		uint256 index,
		uint256 payout,
		bool result,
		address indexed recipient
	);
}
