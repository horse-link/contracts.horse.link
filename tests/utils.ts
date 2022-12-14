import { ethers } from "ethers";
import { concat, hexlify, toUtf8Bytes } from "ethers/lib/utils";

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
