import dotenv from "dotenv";
import fs from "fs";
import {
	loadOracle,
	loadMarket,
	bytes16HexToString,
	setProvider,
	setAxiosClient,
	axiosClient
} from "./utils";

import { formatting, MarketDetails } from "horselink-sdk";

dotenv.config();

const hexZero: Bytes16 = "0x00000000000000000000000000000000";

export type Bytes16 = string;

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

export async function main() {
	const deploymentName = process.argv[2];
	const { chainId, baseApiUrl, privateKeyEnvVar, providerUrlEnvVar } =
		JSON.parse(fs.readFileSync(`./config_${deploymentName}.json`).toString());

	setProvider(process.env[providerUrlEnvVar]);
	setAxiosClient(chainId, baseApiUrl);

	const index = process.argv[3];
	const oracle = await loadOracle(deploymentName, privateKeyEnvVar);

	const marketContract = await loadMarket(
		deploymentName,
		"0x47563a2fA82200c0f652fd4688c71f10a2c8DAF3",
		privateKeyEnvVar
	);

	const bet = await marketContract.getBetByIndex(index);
	const marketId = bytes16HexToString(bet[6]);

	const marketResultResponse = await axiosClient.get(
		`http://localhost:8080/markets/result/${marketId}`
	);

	// check result isnt already set

	const result = await oracle.getResult(bet[6]);
	console.log("result", result);

	if (result[0] === hexZero) {
		const txOracleReceipt = await oracle.setResult(
			bet[6],
			formatting.formatBytes16String("999999999"),
			marketResultResponse.data.signature
		);

		await txOracleReceipt.wait();
		console.log(`adding result for market ${marketId}`, txOracleReceipt.hash);
	}

	const txSettleReceipt = await marketContract.settle(index);
	await txSettleReceipt.wait();

	console.log(`force settling bet ${index}`, txSettleReceipt.hash);
}

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
