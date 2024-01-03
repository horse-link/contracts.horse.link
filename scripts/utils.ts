import fs from "fs";
import path from "path";
import axios from "axios";
import { AxiosInstance } from "axios";
import rlp from "rlp";
import keccak from "keccak";
import { ethers } from "ethers";
import { LedgerSigner } from "@ethersproject/hardware-wallets";
import * as dotenv from "dotenv";
import type { BigNumberish } from "ethers";
import { JsonRpcProvider, Provider } from "@ethersproject/providers";

// load .env into process.env
dotenv.config();

const configPath = path.resolve(__dirname, "../contracts.json");
export let provider: Provider;
export let axiosClient: AxiosInstance;

export type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

export type BetId = string;

export type BetDetails = {
	id: BetId;
	createdAt: string; // BigNum?
	createdAtTx;
	marketId;
	marketAddress;
};

export type DataHexString = string;

export function setProvider(url: string): void {
	provider = new JsonRpcProvider(url);
}

export function setAxiosClient(chainId: string, baseApiUrl: string) {
	axiosClient = axios.create({
		baseURL: baseApiUrl,
		headers: {
			Accept: "application/json",
			"chain-id": chainId
		}
	});
}

export async function getOracle(): Promise<string> {
	const response = await axiosClient.get("/config");
	const data = response.data;
	return data.addresses.marketOracle;
}

export async function loadOracle(
	deployment: string,
	privateKeyEnvVar: string
): Promise<ethers.Contract> {
	const address = await getOracle();
	const deploymentUrl = `https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/${deployment}/${deployment}.json`;
	const response = await axios.get(deploymentUrl);
	const data = response.data.contracts.MarketOracle;

	return new ethers.Contract(address, data.abi, provider).connect(
		new ethers.Wallet(process.env[privateKeyEnvVar], provider)
	);
}

export async function loadMarket(
	deployment: string,
	address: string,
	privateKeyEnvVar: string
): Promise<ethers.Contract> {
	// All the markets are the same, so we'll just the Usdt for now
	const response = await axios.get(
		`https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/${deployment}/${deployment}.json`
	);
	const data = response.data.contracts;
	let contractAbi;
	// For each key in contracts,
	for (const key in data) {
		// If the key is a market contract
		if (key.endsWith("Market")) {
			// If the address matches the one we're looking for
			//if (data[key].address === address) {
			contractAbi = data[key].abi;
			break;
			//}
		}
	}
	if (!contractAbi) {
		throw new Error(`No market contract found at address ${address}`);
	}
	return new ethers.Contract(address, contractAbi, provider).connect(
		new ethers.Wallet(process.env[privateKeyEnvVar], provider)
	);
}

// export function hydrateMarketId(
// 	marketId: string | DataHexString
// ): MarketDetails {
// 	const id = isHexString(marketId) ? bytes16HexToString(marketId) : marketId;
// 	const daysSinceEpoch = parseInt(id.slice(0, 6));
// 	const location = id.slice(6, 9);
// 	const race = parseInt(id.slice(9, 11));
// 	return {
// 		id,
// 		date: daysSinceEpoch,
// 		location,
// 		race
// 	};
// }

// export function bytes16HexToString(hex: DataHexString): string {
// 	const s = Buffer.from(hex.slice(2), "hex").toString("utf8").toString();
// 	// Chop off the trailing 0s
// 	return s.slice(0, s.indexOf("\0"));
// }

export type Seconds = number;

export const getContractAddressFromNonce = async (
	signer,
	nonce
): Promise<string> => {
	const rlpEncoded = rlp.encode([signer.address.toString(), nonce]);
	const longContractAddress = keccak("keccak256")
		.update(rlpEncoded)
		.digest("hex");
	return longContractAddress.substring(24);
};

export const updateContractConfig = (network, newConfig): boolean => {
	const config = JSON.parse(fs.readFileSync(configPath).toString());
	config[network] = newConfig;
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
	return true;
};

const getDerivationPathForIndex = (i: number) => `44'/60'/0'/0/${i}`;

export const getLedgerSigner = (
	index: number,
	provider: ethers.providers.Provider
): LedgerSigner => {
	const signer = new LedgerSigner(
		provider,
		null,
		getDerivationPathForIndex(index)
	);
	// Fix signing for EIP-1559 while ethers.js isn't fixed.
	signer.signTransaction = ledgerSignTransaction;
	return signer;
};

/*
 * Fixes LedgerSigner for EIP1559 while ethers.js isn't fixed.
 * The package.json also uses "resolutions" to upgrade the ledger
 * dependencies to the correct version.
 */
export async function ledgerSignTransaction(
	transaction: ethers.providers.TransactionRequest
): Promise<string> {
	const tx = await ethers.utils.resolveProperties(transaction);
	const baseTx: ethers.utils.UnsignedTransaction = {
		chainId: tx.chainId || undefined,
		data: tx.data || undefined,
		gasLimit: tx.gasLimit || undefined,
		gasPrice: tx.gasPrice || undefined,
		nonce: tx.nonce ? ethers.BigNumber.from(tx.nonce).toNumber() : undefined,
		to: tx.to || undefined,
		value: tx.value || undefined
	};

	// The following three properties are not added to the baseTx above
	// like the other properties only because this results in failure on
	// the hardhat local network.
	if (tx.maxFeePerGas) baseTx.maxFeePerGas = tx.maxFeePerGas;
	if (tx.maxPriorityFeePerGas)
		baseTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
	if (tx.type) baseTx.type = tx.type;

	const unsignedTx = ethers.utils.serializeTransaction(baseTx).substring(2);
	// @ts-ignore
	const sig = await this._retry((eth) =>
		// @ts-ignore
		eth.signTransaction(this.path, unsignedTx)
	);

	return ethers.utils.serializeTransaction(baseTx, {
		v: ethers.BigNumber.from("0x" + sig.v).toNumber(),
		r: "0x" + sig.r,
		s: "0x" + sig.s
	});
}

export const getGasPriceFromEnv = (): ethers.BigNumber => {
	const gasPrice = ethers.BigNumber.from(
		process.env.DEPLOY_GAS_PRICE_WEI.toString()
	);
	if (!ethers.BigNumber.isBigNumber(gasPrice))
		throw new Error("Could not fetch gas price from DEPLOY_GAS_PRICE_WEI env");
	return gasPrice;
};

export type SubgraphBetOptions = {
	unsettledOnly?: Boolean;
	maxResults?: Number;
	payoutAtLt?: Seconds;
};

export async function getSubgraphBetsSince(
	subgraphUrl: string,
	createdAtGt: Seconds,
	options: SubgraphBetOptions = {}
): Promise<BetDetails[]> {
	const timeString = Math.floor(createdAtGt);

	const { unsettledOnly = false, maxResults = 1000, payoutAtLt } = options;

	const whereClauses = [
		`createdAt_gt: "${timeString}"`,
		unsettledOnly ? ", settled_not: true" : "",
		payoutAtLt ? `payoutAt_lt: ${payoutAtLt}` : ""
	];
	const whereClause = whereClauses.filter(Boolean).join(",");

	const betsQuery = `
        {
            bets(where: {${whereClause}}, orderBy: createdAt, first: ${maxResults}, orderDirection: desc) {
                id
                createdAt
                createdAtTx
                marketId
                marketAddress
            }
        }
    `;

	const response = await axios(subgraphUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		data: JSON.stringify({
			query: betsQuery
		})
	});
	return response.data.data.bets;
}
