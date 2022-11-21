// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;
pragma abicoder v2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import {IBet} from "./IBet.sol";
import "./IVault.sol";
import "./IMarket.sol";
import "./IOracle.sol";
import "./SignatureLib.sol";

// Put these in the ERC721 contract
struct Bet {
	bytes32 propositionId;
	bytes32 marketId;
	uint256 amount;
	uint256 payout;
	uint256 payoutDate;
	bool settled;
	address owner;
}

contract Market is Ownable, ERC721 {
	uint256 private constant MAX = 32;
	int256 private constant PRECISION = 1_000;
	uint8 private immutable _fee;
	IVault private immutable _vault;
	address private immutable _self;
	IOracle private immutable _oracle;

	uint256 private _inplayCount; // running count of bets
	Bet[] private _bets;

	// MarketID => Bets Indexes
	mapping(bytes32 => uint256[]) private _marketBets;

	// MarketID => amount bet
	mapping(bytes32 => uint256) private _marketTotal;

	// MarketID => PropositionID => amount bet
	mapping(bytes32 => mapping(uint16 => uint256)) private _marketBetAmount;

	// PropositionID => amount bet
	mapping(bytes32 => uint256) private _potentialPayout;

	uint256 private _totalInPlay;
	uint256 private _totalExposure;

	// Can claim after this period regardless
	uint256 public immutable timeout;
	uint256 public immutable min;

	constructor(
		IVault vault,
		uint8 fee,
		address oracle
	)
	ERC721("Bet", "BET") {
		require(address(vault) != address(0), "Invalid address");
		_self = address(this);
		_vault = vault;
		_fee = fee;
		_oracle = IOracle(oracle);

		timeout = 30 days;
		min = 1 hours;
	}

	mapping(address => uint256) private _workerfees;

	function tokenURI(uint256 tokenId) public pure override returns (string memory) {
		return string(abi.encodePacked("https://api.horse.link/bet/", tokenId));
	}

	function getFee() external view returns (uint8) {
		return _fee;
	}

	function getTotalInPlay() external view returns (uint256) {
		return _totalInPlay;
	}

	function getInPlayCount() external view returns (uint256) {
		return _inplayCount;
	}

	function getCount() external view returns (uint256) {
		return _getCount();
	}

	function _getCount() private view returns (uint256) {
		return _bets.length;
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

	function getExpiry(uint64 id) external view returns (uint256) {
		return _getExpiry(id);
	}

	function getMarketTotal(bytes32 marketId) external view returns (uint256) {
		return _marketTotal[marketId];
	}

	function _getExpiry(uint64 id) private view returns (uint256) {
		return _bets[id].payoutDate + timeout;
	}

	function getBetByIndex(uint256 index)
		external
		view
		returns (
			uint256,
			uint256,
			uint256,
			bool,
			address
		)
	{
		return _getBet(index);
	}

	function _getBet(uint256 index)
		private
		view
		returns (
			uint256,
			uint256,
			uint256,
			bool,
			address
		)
	{
		Bet memory bet = _bets[index];
		return (bet.amount, bet.payout, bet.payoutDate, bet.settled, bet.owner);
	}

	function getOdds(
		int256 wager,
		int256 odds,
		bytes32 propositionId
	) external view returns (int256) {
		if (wager == 0 || odds == 0) return 0;

		return _getOdds(wager, odds, propositionId);
	}

    function _getOdds(
        int256 wager,
        int256 odds,
        bytes32 propositionId
    ) private view returns (int256) {
        address underlying = _vault.asset();
        assert(underlying != address(0));

        int256 p = int256(_vault.getMarketAllowance()); // TODO: check that typecasting to a signed int is safe

        if (p == 0) return 0;

		// f(wager) = odds - odds*(wager/pool)
		if (_potentialPayout[propositionId] > uint256(p)) {
			return 0;
		}

		// do not include this guy in the return
		p -= int256(_potentialPayout[propositionId]);

		return odds - ((odds * ((wager * PRECISION) / p)) / PRECISION);
	}

	function getPotentialPayout(
		bytes32 propositionId,
		uint256 wager,
		uint256 odds
	) external view returns (uint256) {
		return _getPayout(propositionId, wager, odds);
	}

	function _getPayout(
		bytes32 propositionId,
		uint256 wager,
		uint256 odds
	) private view returns (uint256) {
		assert(odds > 0);
		assert(wager > 0);

		// add underlying to the market
		int256 trueOdds = _getOdds(int256(wager), int256(odds), propositionId);
		if (trueOdds == 0) {
			return 0;
		}

		return (uint256(trueOdds) * wager) / 1_000_000;
	}

	function back(
		bytes32 nonce,
		bytes32 propositionId,
		bytes32 marketId,
		uint256 wager,
		uint256 odds,
		uint256 close,
		uint256 end,
		// SignatureLib.Signature calldata signature
		bytes calldata signature
	) external returns (uint256) {
		require(
			end > block.timestamp && block.timestamp > close,
			"back: Invalid date"
		);

		// check the oracle first
		require(
			IOracle(_oracle).checkResult(marketId, propositionId) == false,
			"back: Oracle result already set for this market"
		);
		bytes32 messageHash = keccak256(abi.encodePacked(nonce, propositionId, odds, close, end));
		
		// require(
		// 	SignatureLib.recoverSigner(messageHash, signature) == owner(),
		// 	"onlyMarketOwner: Invalid signature"
		// );

		address _signer = recoverSigner(messageHash, signature);
		require(_signer == owner(), "onlyMarketOwner: Invalid signature");

        address underlying = _vault.asset();

		// add underlying to the market
		uint256 payout = _getPayout(propositionId, wager, odds);

        // escrow
        IERC20(underlying).transferFrom(msg.sender, _self, wager);
        IERC20(underlying).transferFrom(address(_vault), _self, (payout - wager));

		// add to the market
		_marketTotal[marketId] += wager;

		_bets.push(
			Bet(propositionId, marketId, wager, payout, end, false, msg.sender)
		);

		// uint256 count = _bets.length;
		// uint256 index = count - 1;
		// _marketBets[marketId].push(count);
		// _mint(msg.sender, index);

		// _totalInPlay += wager;
		// _totalExposure += (payout - wager);
		// _inplayCount++;

		// emit Placed(index, propositionId, marketId, wager, payout, msg.sender);

		// return count; // token ID

		//uint256 count = _bets.length;
		//uint256 index = count - 1;

		_marketBets[marketId].push(_getCount());
		_mint(msg.sender, _getCount() - 1);

		_totalInPlay += wager;
		_totalExposure += (payout - wager);
		_inplayCount++;

		emit Placed(_getCount() - 1, propositionId, marketId, wager, payout, msg.sender);

		return _getCount();
	}

	function recoverSigner(bytes32 message, bytes memory signature)
        internal
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;

        (v, r, s) = splitSignature(signature);

        return ecrecover(message, v, r, s);
    }

	function splitSignature(bytes memory signature)
        internal
        pure
        returns (uint8, bytes32, bytes32)
    {
        require(signature.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(signature, 32))
            // second 32 bytes
            s := mload(add(signature, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(signature, 96)))
        }

        return (v, r, s);
    }

	function settle(uint256 index) external {
		Bet memory bet = _bets[index];
		require(bet.settled == false, "settle: Bet has already settled");
		bool result = IOracle(_oracle).checkResult(
			bet.marketId,
			bet.propositionId
		);
		_settle(index, result);
	}

	// function settleMarket(
	//     uint256 from,
	//     uint256 to,
	//     bytes32 marketId
	// ) external {
	//     for (uint256 i = from; i < to; i++) {
	//         uint256 index = _marketBets[marketId][i];

	//         if (!_bets[index].settled) {
	//             bytes32 propositionId = IOracle(_oracle).getResult(
	//                 _bets[index].marketId
	//             );

	//             if (_bets[index].propositionId == propositionId) {
	//                 _settle(index, true);
	//             } else {
	//                 _settle(index, false);
	//             }
	//         }
	//     }
	// }

	function _settle(uint256 id, bool result) private {
		require(
			_bets[id].payoutDate < block.timestamp,
			"_settle: Payout date not reached"
		);

		_bets[id].settled = true;
		_totalInPlay -= _bets[id].amount;
		_totalExposure -= _bets[id].payout - _bets[id].amount;
		_inplayCount--;

        address underlying = _vault.asset();

        if (result == true) {
            // Transfer the win to the punter
            IERC20(underlying).transfer(_bets[id].owner, _bets[id].payout);
        }

        if (result == false) {
            // Transfer the proceeds to the vault, less market fee
            IERC20(underlying).transfer(address(_vault), _bets[id].payout);
        }

		_burn(id);

		emit Settled(id, _bets[id].payout, result, _bets[id].owner);
	}

	event Placed(
		uint256 index,
		bytes32 propositionId,
		bytes32 marketId,
		uint256 amount,
		uint256 payout,
		address indexed owner
	);

	event Settled(
		uint256 id,
		uint256 payout,
		bool result,
		address indexed owner
	);
}
