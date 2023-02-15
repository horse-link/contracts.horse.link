import { ethers } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import * as dotenv from "dotenv";
import type { BigNumber } from "ethers";

import { formatBytes16String } from "../scripts/utils";
import type { Signature } from "../scripts/utils";

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
	odds: BigNumber,
	totalOdds: BigNumber
): string => {
	const b16MarketId = formatBytes16String(marketId);
	const b16PropositionId = formatBytes16String(propositionId);
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16", "uint256", "uint256"],
		[b16MarketId, b16PropositionId, odds, totalOdds]
	);
	return message;
};

export const signSetScratchedMessage = async (
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	totalOdds: BigNumber,
	signer: SignerWithAddress
): Promise<Signature> => {
	const settleMessage = makeSetScratchMessage(
		marketId,
		propositionId,
		odds,
		totalOdds
	);
	return await signMessage(settleMessage, signer);
};
