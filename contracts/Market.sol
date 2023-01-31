// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "./IVault.sol";
import "./IMarket.sol";
import "./IOracle.sol";
import "./SignatureLib.sol";
import "./OddsLib.sol";

// Put these in the ERC721 contract
struct Bet {
	bytes16 propositionId;
	bytes16 marketId;
	uint256 amount;
	uint256 payout;
	uint256 payoutDate;
	bool settled;
}

contract Market is IMarket, Ownable, ERC721 {
	uint8 internal immutable _margin;
	IVault internal immutable _vault;
	address internal immutable _self;
	IOracle internal immutable _oracle;

	uint256 internal _inplayCount; // running count of bets
	Bet[] internal _bets;

	// MarketID => Bets Indexes
	mapping(bytes16 => uint64[]) internal _marketBets;

	// MarketID => amount bet
	mapping(bytes16 => uint256) internal _marketTotal;

	// MarketID => PropositionID => amount bet
	mapping(bytes16 => mapping(uint16 => uint256)) internal _marketBetAmount;

	// PropositionID => winnings that could be paid out for this proposition
	mapping(bytes16 => uint256) internal _potentialPayout;

	uint256 internal _totalInPlay;
	uint256 internal _totalExposure;

	// Can claim after this period regardless
	uint256 public immutable timeout;
	uint256 public immutable min;

	mapping(address => bool) private _signers;

	constructor(
		IVault vault,
		uint8 margin,
		uint8 timeoutDays,
		address oracle
	) ERC721("Horse Link Bet Slip", "HL-BET") {
		assert(address(vault) != address(0));
		_self = address(this);
		_vault = vault;
		_margin = margin;
		_oracle = IOracle(oracle);
		_signers[owner()] = true;

		timeout = timeoutDays * 1 days;
		min = 1 hours;
	}

	function tokenURI(uint256 tokenId)
		public
		pure
		override
		returns (string memory)
	{
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


	function getMarketTotal(bytes16 marketId)
		external
		view
		returns (uint256)
	{
		return _marketTotal[marketId];
	}

	function _getExpiry(uint64 index) internal view returns (uint256) {
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
			bytes16, // marketId
			bytes16 // propositionId
		)
	{
		return _getBet(index);
	}

	function _getBet(uint64 index)
		internal
		view
		returns (
			uint256,
			uint256,
			uint256,
			bool,
			bytes16,
			bytes16
		)
	{
		Bet memory bet = _bets[index];
		return (bet.amount, bet.payout, bet.payoutDate, bet.settled, bet.marketId, bet.propositionId);
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

		// If the pool is not sufficient to cover a new bet
		if (pool == 0) return 1;
		// exclude the current total potential payout from the pool
		if (_potentialPayout[propositionId] > pool) {
			return 1;
		}

		pool -= _potentialPayout[propositionId]; //TODO: Should be _totalExposure;

		// Calculate the new odds
		uint256 adjustedOdds = _getAdjustedOdds(wager, odds, pool);
		return adjustedOdds;
	}

	function _getAdjustedOdds(
		uint256 wager,
		uint256 odds,
		uint256 pool
	) internal view returns (uint256) {
		return OddsLib.getLinearAdjustedOdds(wager, odds, pool);
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
	) internal view returns (uint256) {
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
		bytes32 messageHash = keccak256(
			abi.encodePacked(nonce, propositionId, marketId, odds, close, end)
		);

		require(
			isValidSignature(messageHash, signature) == true,
			"back: Invalid signature"
		);

		// add underlying to the market
		uint256 payout = _getPayout(propositionId, marketId, wager, odds);
		assert(payout > 0);

		return _back(propositionId, marketId, wager, close, end, payout);
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
			end > block.timestamp && close > block.timestamp,
			"back: Invalid date"
		);

		// Do not allow a bet placed if we know the result
		require(
			IOracle(_oracle).checkResult(marketId, propositionId) == false,
			"back: Oracle result already set for this market"
		);

		address underlying = _vault.asset();

		// Escrow the wager
		IERC20(underlying).transferFrom(_msgSender(), _self, wager);

		// Add to in play total for this marketId
		_marketTotal[marketId] += wager;
		_totalInPlay += wager;
		_inplayCount++;

		// If the payout for this proposition will be greater than the current max payout for the market)

		uint256 newPotentialPayout = payout - wager;
        _potentialPayout[propositionId] += newPotentialPayout;
        _totalExposure += _obtainCollateral(marketId, propositionId, wager, payout);

		uint64 index = _getCount();
		_bets.push(
			Bet(propositionId, marketId, wager, payout, end, false)
		);
		_marketBets[marketId].push(index);
		_mint(_msgSender(), index);

		emit Placed(
			index,
			propositionId,
			marketId,
			wager,
			payout,
			_msgSender()
		);

		return index;
	}

	function settle(uint64 index) external {
		Bet memory bet = _bets[index];
		require(bet.settled == false, "settle: Bet has already settled");
		require(
			_bets[index].payoutDate < block.timestamp,
			"_settle: Payout date not reached"
		);
		_settle(index);
	}

	function _settle(uint64 index) internal {
		_bets[index].settled = true;
		Bet memory bet = _bets[index];
		bool result = IOracle(_oracle).checkResult(
			bet.marketId,
			bet.propositionId
		);

		if (block.timestamp > _getExpiry(index)) {		
			result = true;
		}
		_payout(index, result);		
		_totalInPlay -= _bets[index].amount;
		_inplayCount--;
		emit Settled(index, _bets[index].payout, result, result ? ownerOf(index) : address(_vault));
		_burn(index);
	}

	function _payout(uint256 index, bool result) internal virtual {
		address recipient = result ? ownerOf(index) : address(_vault.asset());
		IERC20(_vault.asset()).transfer(recipient, _bets[index].payout);
		_totalExposure -= _bets[index].payout - _bets[index].amount;
	}

	// Allow the Vault to provide cover for this market
	// Standard implementation is to request cover for each and every bet
	function _obtainCollateral(bytes16 marketId, bytes16 propositionId, uint256 wager, uint256 payout) internal virtual returns (uint256) {
		uint256 amount = payout - wager;
		IERC20(_vault.asset()).transferFrom(
			address(_vault),
			_self,
			amount
		);
		return amount;
	}

	function settleMarket(bytes16 marketId) external {
		uint64[] memory bets = _marketBets[marketId];
		uint256 total = bets.length;

		for (uint64 i = 0; i < total; i++) {
			uint64 index = bets[i];

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

	function isValidSignature(
		bytes32 messageHash,
		SignatureLib.Signature calldata signature
	) internal view returns (bool) {
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
