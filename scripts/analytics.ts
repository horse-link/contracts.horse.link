import dotenv from "dotenv";
import fs from "fs";
import {
	loadOracle,
	hydrateMarketId,
	loadMarket,
	bytes16HexToString,
	setProvider,
	setAxiosClient,
	axiosClient,
	formatBytes16String
} from "./utils";
import { ERC20__factory } from "../build/typechain";
import { ethers } from "ethers";

dotenv.config();

// const hexZero: Bytes16 = "0x00000000000000000000000000000000";

export type Bytes16 = string;

export async function main() {
	const deploymentName = "prod_arbitrum";
	const { chainId, baseApiUrl, privateKeyEnvVar, providerUrlEnvVar } =
		JSON.parse(fs.readFileSync(`./config_${deploymentName}.json`).toString());

	setAxiosClient(chainId, baseApiUrl);

	const provider = new ethers.providers.JsonRpcProvider(
		process.env[providerUrlEnvVar]
	);

	setProvider(process.env[providerUrlEnvVar]);

	const usdt = await ERC20__factory.connect(
		"0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9",
		provider
	);

	const marketContract = await loadMarket(
		deploymentName,
		"0x47563a2fA82200c0f652fd4688c71f10a2c8DAF3",
		privateKeyEnvVar
	);

	// first usdt deposit @ 90089343
	const start_block = 90089340 + 1000;
	const length = 10;

	const logs = [];

	for (let i = start_block; i < start_block + length; i++) {
		console.info(`Processing Block ${i}`);

		const market_balance = await usdt.balanceOf(
			"0x47563a2fA82200c0f652fd4688c71f10a2c8DAF3",
			{
				blockTag: i
			}
		);

		const vault_balance = await usdt.balanceOf(
			"0xE37ae0A43d0f0e01a4AdB8605da2D2CD915E3906",
			{
				blockTag: i
			}
		);

		const [bet_count, in_play_count, getTotalInPlay, getTotalExposure] =
			await Promise.all([
				await marketContract.getCount({ blockTag: i }),
				await marketContract.getInPlayCount({ blockTag: i }),
				await marketContract.getTotalInPlay({ blockTag: i }),
				await marketContract.getTotalExposure({ blockTag: i })
			]);

		logs.push([
			i,
			market_balance.toString(),
			vault_balance.toString(),
			bet_count.toString(),
			in_play_count.toString(),
			getTotalInPlay.toString(),
			getTotalExposure.toString()
		]);
	}

	console.table(logs);
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
