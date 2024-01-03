import { BigNumberish, ethers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as dotenv from "dotenv";
import type { BigNumber } from "ethers";
import { Market, Token, Vault } from "../build/typechain";
import {
	EcSignature,
	Signature,
	formatting,
	markets,
	signature
} from "horselink-sdk";
import { BackStruct } from "../build/typechain/IMarket";

// load .env into process.env
dotenv.config();

// export const signBackMessage = async (
// 	nonce: string,
// 	marketId: string,
// 	propositionId: string,
// 	odds: BigNumber,
// 	close: number,
// 	end: number,
// 	signer: SignerWithAddress
// ): Promise<Signature> => {
// 	const message = ethers.utils.solidityKeccak256(
// 		[
// 			"bytes16", // nonce
// 			"bytes16", // propositionId
// 			"bytes16", // marketId
// 			"uint256", // odds
// 			"uint256", // close
// 			"uint256" // end
// 		],
// 		[
// 			formatting.formatBytes16String(nonce),
// 			formatting.formatBytes16String(propositionId),
// 			formatting.formatBytes16String(marketId),
// 			odds,
// 			close,
// 			end
// 		]
// 	);
// 	return await signMessage(message, signer);
// };

// export const signMessage = async (
// 	message: string,
// 	signer: SignerWithAddress
// ): Promise<Signature> => {
// 	const sig = await signer.signMessage(ethers.utils.arrayify(message));
// 	const { v, r, s } = ethers.utils.splitSignature(sig);
// 	return { v, r, s };
// };

export const signSetResultMessage = async (
	marketId: string,
	propositionId: string,
	signer: SignerWithAddress
): Promise<EcSignature> => {
	const settleMessage = makeSetResultMessage(marketId, propositionId);
	return await signature.signMessage(settleMessage, signer);
};

export const makeSetResultMessage = (
	marketId: string,
	propositionId: string
): string => {
	const b16MarketId = formatting.formatBytes16String(marketId);
	const b16PropositionId = formatting.formatBytes16String(propositionId);
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16"],
		[b16MarketId, b16PropositionId]
	);
	return message;
};

export const makeRefundMessage = (
	marketAddress: string,
	betIndex: BigNumberish
): string => {
	const b16Refund = formatting.formatBytes16String("refund");
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "address", "uint64"],
		[b16Refund, marketAddress, betIndex]
	);
	return message;
};

export const signBackMessageWithRisk = async (
	nonce: string,
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	close: number,
	end: number,
	risk: number,
	signer: SignerWithAddress
): Promise<EcSignature> => {
	const message = ethers.utils.solidityKeccak256(
		[
			"bytes16", // nonce
			"bytes16", // propositionId
			"bytes16", // marketId
			"uint256", // odds
			"uint256", // close
			"uint256", // end
			"uint256" // risk
		],
		[
			formatting.formatBytes16String(nonce),
			formatting.formatBytes16String(propositionId),
			formatting.formatBytes16String(marketId),
			odds,
			close,
			end,
			risk
		]
	);
	return await signature.signMessage(message, signer);
};

export const makeSetScratchMessage = (
	marketId: string,
	propositionId: string,
	odds: BigNumber
): string => {
	const b16MarketId = formatting.formatBytes16String(marketId);
	const b16PropositionId = formatting.formatBytes16String(propositionId);
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16", "uint256"],
		[b16MarketId, b16PropositionId, odds]
	);
	return message;
};

export const signSetScratchedMessage = async (
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	signer: SignerWithAddress
): Promise<EcSignature> => {
	const scratchedMessage = makeSetScratchMessage(marketId, propositionId, odds);
	return await signature.signMessage(scratchedMessage, signer);
};

type MarketStats = {
	marketTotal: BigNumber;
	exposure: BigNumber;
	inPlay: BigNumber;
	vaultBalance: BigNumber;
};

export async function getMarketStats(
	marketId: string,
	market: Market,
	token: Token,
	vault: Vault
): Promise<MarketStats> {
	const marketTotal = await market.getMarketTotal(
		formatting.formatBytes16String(marketId)
	);
	const exposure = await market.getTotalExposure();
	const inPlay = await market.getTotalInPlay();
	const vaultBalance = await token.balanceOf(vault.address);
	return {
		marketTotal,
		exposure,
		inPlay,
		vaultBalance
	};
}

// type BackStruct = {
// 	nonce: string;
// 	propositionId: string;
// 	marketId: string;
// 	wager: BigNumberish;
// 	odds: BigNumberish;
// 	close: BigNumberish;
// 	end: BigNumberish;
// 	betSignature: Signature;
// };

export type TestRunner = {
	runnerNumber: number;
	name: string;
	propositionId: string;
};

export type TestBet = {
	market: TestMarket;
	runner: TestRunner;
	amount: number;
	odds: number;
	bettor: SignerWithAddress;
};

export type TestMarket = {
	name: string;
	marketId: string;
	runners: TestRunner[];
};

export const END = 1000000000000;

export async function makeBet(
	token: Token,
	marketContract: Market,
	vault: Vault,
	bet: TestBet,
	owner: SignerWithAddress,
	now?: number
): Promise<MarketStats> {
	const tokenDecimals = await token.decimals();
	await token
		.connect(bet.bettor)
		.approve(
			marketContract.address,
			ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals)
		);

	const nonce = "1";
	const close = (now ?? 0) + END;
	const end = (now ?? 0) + END;
	const wager = ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals);
	const odds = ethers.utils.parseUnits(bet.odds.toString(), 6);
	const b16Nonce = formatting.formatBytes16String(nonce);
	const b16PropositionId = formatting.formatBytes16String(
		bet.runner.propositionId
	);
	const b16MarketId = formatting.formatBytes16String(bet.market.marketId);

	const betSignature = await signature.signBackMessage(
		nonce,
		bet.market.marketId,
		bet.runner.propositionId,
		odds,
		close,
		end,
		owner
	);

	const awardedOdds = await marketContract.getOdds(
		wager,
		odds,
		b16PropositionId,
		b16MarketId
	);
	console.log("awardedOdds", awardedOdds.toString());

	const betStruct: BackStruct = {
		nonce: b16Nonce,
		propositionId: b16PropositionId,
		marketId: b16MarketId,
		wager,
		odds,
		close,
		end,
		signature: betSignature
	};

	await marketContract.connect(bet.bettor).back(betStruct);
	return getMarketStats(bet.market.marketId, marketContract, token, vault);
}

export function printMarketStats(marketId: string, stats: MarketStats) {
	console.log("Market ID: ", marketId);
	console.log("Market Total: ", stats.marketTotal.toString());
	console.log("Exposure: ", stats.exposure.toString());
	console.log("In Play: ", stats.inPlay.toString());
	console.log("Vault Balance: ", stats.vaultBalance.toString());
}

const MS_DELAY = 7200 * 1000;

export const Markets: { [key: string]: TestMarket } = {
	RedRacetrack: {
		name: "Red Racetrack",
		marketId: markets.makeMarketId(new Date(), "RED", "1", "W"),
		runners: []
	},
	BlueDogs: {
		name: "Blue Dogs",
		marketId: markets.makeMarketId(new Date(), "BLU", "1", "W"),
		runners: []
	},
	GreenRace: {
		name: "Green Race",
		marketId: markets.makeMarketId(
			new Date(new Date().getTime() + MS_DELAY),
			"GRN",
			"1",
			"W"
		),
		runners: []
	}
};
Markets.RedRacetrack.runners = [
	{
		runnerNumber: 1,
		name: "Red 1",
		propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Red 2",
		propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 2)
	},
	{
		runnerNumber: 3,
		name: "Red 3",
		propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 3)
	}
];
Markets.BlueDogs.runners = [
	{
		runnerNumber: 1,
		name: "Blue 1",
		propositionId: markets.makePropositionId(Markets.BlueDogs.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Blue 2",
		propositionId: markets.makePropositionId(Markets.BlueDogs.marketId, 2)
	}
];
Markets.GreenRace.runners = [
	{
		runnerNumber: 1,
		name: "Green 1",
		propositionId: markets.makePropositionId(Markets.GreenRace.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Green 2",
		propositionId: markets.makePropositionId(Markets.GreenRace.marketId, 2)
	}
];

// REMOVE?
// what the contract needs
export const constructBet = (
	b16Nonce: string,
	b16PropositionId: string,
	b16MarketId: string,
	wager: BigNumberish,
	odds: BigNumberish,
	close: BigNumberish,
	end: BigNumberish,
	signature: EcSignature
): BackStruct => {
	return {
		nonce: b16Nonce,
		propositionId: b16PropositionId,
		marketId: b16MarketId,
		wager,
		odds,
		close,
		end,
		signature
	};
};
