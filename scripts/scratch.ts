import { ethers } from "ethers";
import axios from "axios";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { getSubgraphBetsSince, loadOracle } from "./utils";
import type { Signature } from "./utils";
import { MarketDetails, formatting, markets } from "horselink-sdk";

// load .env into process.env
dotenv.config();

const baseApiUrl = process.env.API_URL ?? "https://alpha.horse.link/api";
console.log(`Using API URL: ${baseApiUrl}`);

async function setScratch(
	oracle: ethers.Contract,
	marketId: string,
	propositionId: string,
	odds: string,
	totalOdds: string,
	signature: Signature
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
	const bnOdds = ethers.utils.parseUnits(Number(odds).toFixed(6), 6);
	const bnTotalOdds = ethers.utils.parseUnits(Number(totalOdds).toFixed(6));
	const encodedProposition = formatting.formatBytes16String(propositionId);
	const encodedMarket = formatting.formatBytes16String(marketId);

	try {
		const receipt = await oracle.setScratchedResult(
			encodedMarket,
			encodedProposition,
			bnOdds,
			bnTotalOdds,
			signature
		);
		return receipt;
	} catch (err) {
		console.error(err);
		return;
	}
}

async function main() {
	let state;
	try {
		state = JSON.parse(fs.readFileSync("state.json", "utf8"));
	} catch (error) {
		console.log("No state file found, starting from scratch");
		state = { last_run: 0, watch_list: [], processed_items: [] };
	}
	const oracle = await loadOracle();
	console.log(`Watch list contains ${state.watch_list.length} races`);

	// Fetch bets placed since the last run. Add their market IDs to the watch list.
	const lastRun = state.last_run ?? 0;
	const thisRun = Math.floor(Date.now() / 1000);
	const bets = await getSubgraphBetsSince(lastRun);
	console.log(`Found ${bets.length} new bets`);
	let newMarketsCount = 0;
	for (const bet of bets) {
		const marketId = formatting.bytes16HexToString(bet.marketId);
		if (!state.watch_list.includes(marketId)) {
			state.watch_list.push(marketId);
			newMarketsCount++;
		}
	}
	console.log(`Added ${newMarketsCount} new markets to watch list`);

	// For each market in the watch list, fetch the race details
	const processedItems: string[] = [];
	for (const marketId of state.watch_list) {
		// hydrate market ID
		const hydratedMarket = markets.rehydrateMarketId(marketId);
		const location = hydratedMarket.location;
		const race = hydratedMarket.race;

		// Get the scratch data from the API
		const marketResultUrl = `${baseApiUrl}/bets/${marketId}?sign=true`;
		const marketResponse = await axios.get(marketResultUrl);
		const marketData = marketResponse.data;

		// Process any scratched runners
		const runners = marketData.scratchedRunners;
		console.log(
			`Market ${marketId} has ${runners?.length ?? "no"} scratched runners`
		);
		if (runners && runners.length > 0) {
			console.log("======================================");
			console.log(
				`Venue: ${location} Race: ${race} Date: ${new Date(
					hydratedMarket.date * 24 * 60 * 60 * 1000
				)}`
			);
			console.log(`${runners.length} scratched runners`);
			for (const runner of runners) {
				try {
					const propositionId = formatting.bytes16HexToString(
						runner.b16propositionId
					);
					const proposition = markets.hydratePropositionId(propositionId);
					console.log(`  - ${proposition.number}`);
					// If not already processed,
					if (!processedItems.includes(propositionId)) {
						if (!runner.signature) {
							console.log("    already registered");
							continue;
						}

						// Send this proposition to Oracle contract
						console.log(`    sending ${propositionId} to Oracle`);
						const signature = runner.signature;

						const receipt = await setScratch(
							oracle,
							marketId,
							propositionId,
							runner.odds,
							runner.totalOdds,
							signature
						);
						console.log("    tx hash:", receipt.hash);

						// Add to processed_items
						processedItems.push(propositionId);
					}
				} catch (error) {
					console.log("    Error processing scratched runner:", error);
				}
			}
		}
		if (marketData.marketResultAdded) {
			console.log(`Removing closed market ${marketId} from watch list`);
			state.watch_list = state.watch_list.filter((id) => id !== marketId);
		}
	}
	state.last_run = thisRun;
	console.log("Writing state");
	fs.writeFileSync("./state.json", JSON.stringify(state, null, 4));
}

main()
	.then(() => {
		console.log("Done");
		process.exit(0);
	})
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
