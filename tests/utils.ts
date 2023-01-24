import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, ethers } from "ethers";
import { concat, hexlify, toUtf8Bytes } from "ethers/lib/utils";

type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

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

export function formatBytes16String(text: string): string {
	// Get the bytes
	const bytes = toUtf8Bytes(text);

	// Check we have room for null-termination
	if (bytes.length > 15) {
		throw new Error("bytes16 string must be less than 16 bytes");
	}

	// Zero-pad (implicitly null-terminates)
	return hexlify(concat([bytes, ethers.constants.HashZero]).slice(0, 16));
}

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

const makeSetResultMessage = (
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

const signMessageAsString = async (
	message: string,
	signer: SignerWithAddress
) => {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	return sig;
};

const signBackMessageWithRisk = async (
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
