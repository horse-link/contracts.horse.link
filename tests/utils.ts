import { BigNumberish, ethers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as dotenv from "dotenv";
import type { BigNumber } from "ethers";

import { formatBytes16String } from "../scripts/utils";
import type { Signature } from "../scripts/utils";
import { Market, Token, Vault } from "../build/typechain";
import { prototype } from "events";

export const node = process.env.GOERLI_URL;
export const provider = new ethers.providers.JsonRpcProvider(node);

// load .env into process.env
dotenv.config();

export type MarketDetails = {
	id: string;
	date: number;
	location: string;
	race: number;
};

export type DataHexString = string;

export const getEventData = (
	eventName: string,
	contract: ethers.Contract,
	txResult: ethers.ContractReceipt
): unknown => {
	if (!Array.isArray(txResult.logs)) return null;
	for (const log of txResult.logs) {
		try {
			const decoded = contract.interface.parseLog(log);
			if (decoded.name === eventName)
				return {
					...decoded,
					...decoded.args
				};
		} catch (error) {}
	}
	return null;
};

export function makeMarketId(date: Date, location: string, raceNumber: string) {
	//Turn Date object into number of days since 1/1/1970, padded to 6 digits
	const MILLIS_IN_DAY = 1000 * 60 * 60 * 24;
	const daysSinceEpoch = Math.floor(date.getTime() / MILLIS_IN_DAY)
		.toString()
		.padStart(6, "0");
	return `${daysSinceEpoch}${location}${raceNumber
		.toString()
		.padStart(2, "0")}`;
}

// RaceId 15 chars
// MMMMMMMMMMMPPP
export function makePropositionId(marketId: string, prediction: number) {
	return `${marketId}W${prediction.toString().padStart(2, "0")}`;
}

export const signBackMessage = async (
	nonce: string,
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	close: number,
	end: number,
	signer: SignerWithAddress
): Promise<Signature> => {
	const message = ethers.utils.solidityKeccak256(
		[
			"bytes16", // nonce
			"bytes16", // propositionId
			"bytes16", // marketId
			"uint256", // odds
			"uint256", // close
			"uint256" // end
		],
		[
			formatBytes16String(nonce),
			formatBytes16String(propositionId),
			formatBytes16String(marketId),
			odds,
			close,
			end
		]
	);
	return await signMessage(message, signer);
};

export const signMessage = async (
	message: string,
	signer: SignerWithAddress
): Promise<Signature> => {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	const { v, r, s } = ethers.utils.splitSignature(sig);
	return { v, r, s };
};

export const signSetResultMessage = async (
	marketId: string,
	propositionId: string,
	signer: SignerWithAddress
): Promise<Signature> => {
	const settleMessage = makeSetResultMessage(marketId, propositionId);
	return await signMessage(settleMessage, signer);
};

export const makeSetResultMessage = (
	marketId: string,
	propositionId: string
): string => {
	const b16MarketId = formatBytes16String(marketId);
	const b16PropositionId = formatBytes16String(propositionId);
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
	const b16Refund = formatBytes16String("refund");
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "address", "uint64"],
		[b16Refund, marketAddress, betIndex]
	);
	return message;
};

export const signMessageAsString = async (
	message: string,
	signer: SignerWithAddress
) => {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	return sig;
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
): Promise<Signature> => {
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
			formatBytes16String(nonce),
			formatBytes16String(propositionId),
			formatBytes16String(marketId),
			odds,
			close,
			end,
			risk
		]
	);
	return await signMessage(message, signer);
};

export const makeSetScratchMessage = (
	marketId: string,
	propositionId: string,
	odds: BigNumber
): string => {
	const b16MarketId = formatBytes16String(marketId);
	const b16PropositionId = formatBytes16String(propositionId);
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
): Promise<Signature> => {
	const settleMessage = makeSetScratchMessage(marketId, propositionId, odds);
	return await signMessage(settleMessage, signer);
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
		formatBytes16String(marketId)
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
	const b16Nonce = formatBytes16String(nonce);
	const b16PropositionId = formatBytes16String(bet.runner.propositionId);
	const b16MarketId = formatBytes16String(bet.market.marketId);

	const signature = await signBackMessage(
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

	const betStruct = {
		nonce: b16Nonce,
		propositionId: b16PropositionId,
		marketId: b16MarketId,
		wager,
		odds,
		close,
		end,
		signature
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
		marketId: makeMarketId(new Date(), "RED", "1"),
		runners: []
	},
	BlueDogs: {
		name: "Blue Dogs",
		marketId: makeMarketId(new Date(), "BLU", "1"),
		runners: []
	},
	GreenRace: {
		name: "Green Race",
		marketId: makeMarketId(
			new Date(new Date().getTime() + MS_DELAY),
			"GRN",
			"1"
		),
		runners: []
	}
};
Markets.RedRacetrack.runners = [
	{
		runnerNumber: 1,
		name: "Red 1",
		propositionId: makePropositionId(Markets.RedRacetrack.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Red 2",
		propositionId: makePropositionId(Markets.RedRacetrack.marketId, 2)
	},
	{
		runnerNumber: 3,
		name: "Red 3",
		propositionId: makePropositionId(Markets.RedRacetrack.marketId, 3)
	}
];
Markets.BlueDogs.runners = [
	{
		runnerNumber: 1,
		name: "Blue 1",
		propositionId: makePropositionId(Markets.BlueDogs.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Blue 2",
		propositionId: makePropositionId(Markets.BlueDogs.marketId, 2)
	}
];
Markets.GreenRace.runners = [
	{
		runnerNumber: 1,
		name: "Green 1",
		propositionId: makePropositionId(Markets.GreenRace.marketId, 1)
	},
	{
		runnerNumber: 2,
		name: "Green 2",
		propositionId: makePropositionId(Markets.GreenRace.marketId, 2)
	}
];

export function constructBet(
	b16Nonce: string,
	b16PropositionId: string,
	b16MarketId: string,
	wager: BigNumberish,
	odds: BigNumberish,
	close: BigNumberish,
	end: BigNumberish,
	signature: Signature
) {
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
}
