import { BigNumber, BigNumberish, ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import * as fs from "fs";
import { getSubgraphBetsSince, Seconds, bytes16HexToString } from "./utils";
import { int } from "hardhat/internal/core/params/argumentTypes";

export type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

export type MarketDetails = {
	id: string;
	date: number;
	location: string;
	race: number;
};

export type RaceDetails = {
	id: string;
	market: MarketDetails;
	number: string;
};

export type Milliseconds = number;

// load .env into process.env
dotenv.config();

export const node = process.env.GOERLI_URL;
export const provider = new ethers.providers.JsonRpcProvider(node);

export async function getOracle(): Promise<string> {
	const response = await axios.get("https://alpha.horse.link/api/config");
	const data = response.data;
	return data.addresses.marketOracle;
}

export async function loadOracle(): Promise<ethers.Contract> {
	const address = await getOracle();
	const response = await axios.get(
		"https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/MarketOracle.json"
	);
	const data = response.data;
	return new ethers.Contract(address, data.abi, provider).connect(
		new ethers.Wallet(process.env.SETTLE_PRIVATE_KEY, provider)
	);
}

export function hydrateMarketId(marketId: string): MarketDetails {
	const id = bytes16HexToString(marketId);
	//Convert daysSinceEpoch to date
	const date = parseInt(id.slice(0, 6));
	const location = id.slice(6, 9);
	const race = parseInt(id.slice(9, 11));
	return {
		id,
		date,
		location,
		race
	};
}

export function hydratePropositionId(propositionId: string): RaceDetails {
	const id = propositionId.slice(0, 13);
	const market = hydrateMarketId(propositionId.slice(0, 11));
	const number = propositionId.slice(12, 14);
	return {
		id,
		market,
		number
	};
}

export async function main() {
	const oracle = await loadOracle();
	const now: Milliseconds = Date.now();
	console.log(`Current Time: ${now}`);

	// Now less 2 hours
	const closeTime: Seconds = Math.floor(now / 1000) - 2 * 60 * 60;
	console.log(`"Using close time of ${closeTime}"`);

	const bets = await getSubgraphBetsSince(closeTime);

	console.log("saving bets to bets.json");
	fs.writeFileSync("bets.json", JSON.stringify(bets));

	bets.forEach(({ id, marketAddress }) => {
		const hydratedMarket = hydrateMarketId(id);
		const response = await axiom.get(hydratedMarket.id);
		// TODO
		// # check if result has been added to the oracle
		// result = get_result(oracle, id)

		// # If we have a result from the API and the oracle has not already added the result
		// if response.status_code == 200 and result != b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
		//     print(f"Settling bet {bet[id]} for market {bet['marketAddress']}")

		//     tx_receipt = settle(market, i)
		//     print(tx_receipt)
	});
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
