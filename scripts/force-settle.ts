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
	axiosClient,
	formatBytes16String
} from "./utils";
import type { MarketDetails } from "./utils";
import type { AxiosResponse } from "axios";
import { Contract, ethers } from "ethers";
import {
	makeMarketId,
	makePropositionId,
	signSetResultMessage
} from "../tests/utils";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

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

const makeSetMarketOracleResultMessage = (
	marketId: string,
	propositionId: string
) => {
	const setMarketOracleResultMessage = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16"],
		[marketId, propositionId]
	);
	return setMarketOracleResultMessage;
};

export async function main() {
	const deploymentName = process.argv[2];

	const winningPropositionId = process.argv[3]; // Set the provided winner as the result
	const marketId = process.argv[4]; // Set the provided marketId as the result

	// const marketId = makeMarketId(process.argv[4]);
	// const propositionId = makePropositionId(marketId, 1);

	const { chainId, baseApiUrl, privateKeyEnvVar, providerUrlEnvVar } =
		JSON.parse(fs.readFileSync(`./config_${deploymentName}.json`).toString());

	setProvider(process.env[providerUrlEnvVar]);
	setAxiosClient(chainId, baseApiUrl);

	// let oracleSigner: SignerWithAddress = new ethers.Wallet(privateKeyEnvVar);

	// const signature = await signSetResultMessage(
	// 	marketId,
	// 	winningPropositionId,
	// 	oracleSigner
	// );

	const oracle = await loadOracle(deploymentName, privateKeyEnvVar);

	console.log(`Adding market winner ${winningPropositionId}`);

	let result;
	try {
		result = await oracle.getResult(formatBytes16String(marketId));
	} catch (e) {
		console.log("getResult failed:", JSON.stringify(e));
	}

	if (result === undefined) {
		console.log(
			`no result from oracle.getResult() for marketId ${marketId}(${bytes16HexToString(
				marketId
			)})`
		);
	}

	const signature = makeSetMarketOracleResultMessage(
		marketId,
		winningPropositionId
	);

	if (result.winningPropositionId === hexZero) {
		// if the oracle doesn't know about it, tell it about it.
		try {
			const txReceipt = await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(winningPropositionId),
				signature
			);
			console.log(`adding result for market ${marketId}`, txReceipt.hash);
		} catch (e) {
			console.log("setResult failed:", JSON.stringify(e));
		}

		// we won't wait for it to be mined here,
		// we'll just process it on the next run
		// } else {
		// 	// There is a result so we can settle

		// 	const index = bet.id.split("_")[2];
		// 	const txReceipt = await marketContract.settle(index).catch((e) => {
		// 		return { hash: `FAILED: ${e?.error?.reason}` };
		// 	});
		// 	console.log(`settle bet ${bet.id} (#${index}), receipt`, txReceipt.hash);
		// }
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

// npx ts-node scripts/force-settle.ts prod_arbitrum 019614BOW01 019614BOW0109 eg 2023-09-14_BOW_1_W1
