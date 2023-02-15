import axios from "axios";
import * as dotenv from "dotenv";
import {
	getSubgraphBetsSince,
	loadOracle,
	hydrateMarketId,
	loadMarket,
	Seconds
} from "./utils";
import type { MarketDetails } from "./utils";

// load .env into process.env
dotenv.config();

const hexZero: Bytes16 = "0x00000000000000000000000000000000";
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

// TODO: Add a better type for this data structure:
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

	// Process up to 50 most recent, starting with most recent
	for (const bet of bets) {
		const market = hydrateMarketId(bet.marketId);
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
	}
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
