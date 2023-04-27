import dotenv from "dotenv";
import fs from "fs";
import {
	getSubgraphBetsSince,
	loadOracle,
	hydrateMarketId,
	loadMarket,
	Seconds,
	bytes16HexToString,
	setProvider,
	setAxiosClient,
	axiosClient
} from "./utils";
import type { MarketDetails } from "./utils";
import type { AxiosResponse } from "axios";

dotenv.config();
const hexZero: Bytes16 = "0x00000000000000000000000000000000";
const HOUR_IN_SECONDS = 60 * 60;

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
	const deploymentName = process.argv[2];
	const { chainId, baseApiUrl, subgraphUrl, privateKeyEnvVar, providerUrl } =
		JSON.parse(fs.readFileSync(`./config_${deploymentName}.json`).toString());
	setProvider(providerUrl);
	setAxiosClient(chainId, baseApiUrl);

	const oracle = await loadOracle(deploymentName, privateKeyEnvVar);
	const now: Seconds = Math.floor(Date.now() / 1000);
	console.log(`Current Time: ${now} (seconds)`);

	const closeTime: Seconds = now - 48 * HOUR_IN_SECONDS;
	console.log(`"Using close time of ${closeTime} (seconds)"`);

	const bets: BetDetails[] = await getSubgraphBetsSince(
		subgraphUrl,
		closeTime,
		{
			unsettledOnly: true,
			maxResults: 150,
			payoutAtLt: now
		}
	);

	console.log(`Found ${bets.length} unsettled bets`);

	for (const bet of bets) {
		const market = hydrateMarketId(bet.marketId);
		// TODO: cache me
		const marketContract = await loadMarket(
			deploymentName,
			bet.marketAddress,
			privateKeyEnvVar
		);

		let marketResultResponse: AxiosResponse;
		// Get race result
		// TODO: Only query each market once
		try {
			marketResultResponse = await axiosClient.get(
				`/markets/result/${market.id}?sign=true`
			);
			if (marketResultResponse.status !== 200) {
				console.log(`request failure for market ${market.id}:`, {
					status: marketResultResponse?.status,
					statusText: marketResultResponse?.statusText,
					url: marketResultResponse?.config?.url,
					data: marketResultResponse?.request?.data
				});
				continue;
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (e: any) {
			// TODO: type as axios.AxiosError;
			console.log(`request failure for market ${market.id}:`, {
				responseStatus: e?.response?.status,
				responseStatusText: e?.response?.statusText,
				url: e?.config?.url,
				data: e?.request?.data
			});
			continue;
		}

		let result;
		try {
			result = await oracle.getResult(bet.marketId);
		} catch (e) {
			console.log("getResult failed:", JSON.stringify(e));
			continue;
		}

		if (result === undefined) {
			console.log(
				`no result from oracle.getResult() for marketId ${
					bet.marketId
				}(${bytes16HexToString(bet.marketId)})`
			);
			continue;
		}

		if (result.winningPropositionId === hexZero) {
			// if the oracle doesn't know about it, tell it about it.
			try {
				const txReceipt = await oracle.setResult(
					bet.marketId,
					marketResultResponse.data.winningPropositionId,
					marketResultResponse.data.signature
				);
				console.log(`adding result for market ${bet.marketId}`, txReceipt.hash);
			} catch (e) {
				console.log("setResult failed:", JSON.stringify(e));
				continue;
			}

			// we won't wait for it to be mined here,
			// we'll just process it on the next run
		} else {
			// There is a result so we can settle

			const index = bet.id.split("_")[2];
			const txReceipt = await marketContract.settle(index).catch((e) => {
				return { hash: `FAILED: ${e?.error?.reason}` };
			});
			console.log(`settle bet ${bet.id}(${index}), receipt`, txReceipt.hash);
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
