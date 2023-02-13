import { BigNumber, BigNumberish, ethers } from "ethers";
import axios from "axios";
import * as fs from "fs";
import {
	getSubgraphBetsSince,
	loadOracle,
	hydrateMarketId,
	loadMarket,
	Seconds,
	bytes16HexToString
} from "./utils";
import type { MarketDetails } from "./utils";

const hexZero: Bytes16 = "0x00000000000000000000000000000000";
export type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

export type RaceDetails = {
	id: string;
	market: MarketDetails;
	number: string;
};

export type BetDetails = {
	id: string;
	createdAt: string;
	createdAtTx: string;
	marketId: string;
	marketAddress: string;
};

export type Milliseconds = number;
export type Bytes16 = string;

// [
// 	'0x00000000000000000000000000000000',
// 	[],
// 	winningPropositionId: '0x00000000000000000000000000000000',
// 	scratched: []
//   ]
// that's result[0],result[1], result.winningPropositionId, result.scratched
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type OracleResult = Array<any>;

export async function main() {
	const oracle = await loadOracle();
	const now: Milliseconds = Date.now();
	console.log(`Current Time: ${now}`);

	// Now less 2 hours
	const closeTime: Seconds = Math.floor(now / 1000) - 2 * 60 * 60;
	console.log(`"Using close time of ${closeTime}"`);

	const bets: BetDetails[] = await getSubgraphBetsSince(closeTime);

	console.log("saving bets to bets.json");
	fs.writeFileSync("bets.json", JSON.stringify(bets));

	// Process up to 50 most recent, starting with most recent
	for (const bet of bets) {
		const market = hydrateMarketId(bet.marketId);
		// const response = await axios.get(market.id);

		// TODO: cache me
		const marketContract = await loadMarket(bet.marketAddress);

		let marketResultResponse;
		// Get race result
		try {
			marketResultResponse = await axios.get(
				`https://alpha.horse.link/api/markets/result/${market.id}?sign=true`
			);
			if (marketResultResponse.status !== 200) {
				console.log(
					`request failure for market ${market.id}:`,
					marketResultResponse
				);
				continue;
			}
		} catch (e) {
			console.log(`request failure for market ${market.id}:`, e);
			continue;
		}
		// TODO .catch() the promise

		const result = await oracle.getResult(bet.marketId);

		if (result.winningPropositionId === hexZero) {
			// if the oracle doesn't know about it, tell it about it.
			const receipt = await oracle.setResult(
				bet.marketId,
				marketResultResponse.data.winningPropositionId,
				marketResultResponse.data.signature
			);
			console.log("receipt", receipt);
			console.log(`adding result for market ${bet.marketId}`, receipt.hash);

			// we won't wait for it to be mined here,
			// we'll just process it on the next run
		} else {
			// There is a result so we can settle

			const index = bet.id.split("_")[2];
			const txReceipt = await marketContract.settle(index);
			console.log(`settled bet ${bet.id}(${index}), receipt`, txReceipt.hash);
			console.log("txReceipt", txReceipt);
		}

		// now that the oracle knows about the race, settle the bet.

		// # If we have a result from the API and the oracle has not already added the result
		// if response.status_code == 200 and result != b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
		//     print(f"Settling bet {bet[id]} for market {bet['marketAddress']}")

		//     tx_receipt = settle(market, i)
		//     print(tx_receipt)
	}
}

export function formatBytes16String(text: string): string {
	// Get the bytes
	const bytes = ethers.utils.toUtf8Bytes(text);

	// Check we have room for null-termination
	if (bytes.length > 15) {
		throw new Error("bytes16 string must be less than 16 bytes");
	}

	// Zero-pad (implicitly null-terminates)
	return ethers.utils.hexlify(
		ethers.utils.concat([bytes, ethers.constants.HashZero]).slice(0, 16)
	);
}

// This is a translation of a pythonism: `ts-node settle.ts` will run main(),
// but import/require("settle") won't
if (require.main === module) {
	main()
		.then(() => {
			console.log("Done");
			process.exit(0);
		})
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}
