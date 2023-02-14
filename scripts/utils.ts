import fs from "fs";
import path from "path";
import axios from "axios";
import rlp from "rlp";
import keccak from "keccak";
import { ethers } from "ethers";
import { concat, hexlify, isHexString, toUtf8Bytes } from "ethers/lib/utils";
import { LedgerSigner } from "@ethersproject/hardware-wallets";

import type { BigNumberish } from "ethers";

export const node = process.env.GOERLI_URL;
export const provider: ethers.providers.Provider =
	new ethers.providers.JsonRpcProvider(node);

const configPath = path.resolve(__dirname, "../contracts.json");

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

export type BetId = string;

export type BetDetails = {
	id: BetId;
	createdAt: string; // BigNum?
	createdAtTx;
	marketId;
	marketAddress;
};

export type DataHexString = string;

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

export async function loadMarket(address: string): Promise<ethers.Contract> {
	// All the markets are the same, so we'll just the Usdt for now
	const response = await axios.get(
		`https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/UsdtMarket.json`
	);
	const data = response?.data;
	return new ethers.Contract(address, data.abi, provider).connect(
		new ethers.Wallet(process.env.SETTLE_PRIVATE_KEY, provider)
	);
}

export function bytes16HexToString(hex: DataHexString): string {
	const s = Buffer.from(hex.slice(2), "hex").toString("utf8").toString();
	// Chop off the trailing 0s
	return s.slice(0, s.indexOf("\0"));
}

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

export async function getSubgraphBetsSince(
	createdAtGt: Seconds
): Promise<BetDetails[]> {
	const timeString = Math.floor(createdAtGt);
	const betsQuery = `
        {
            bets(where: {createdAt_gt: "${timeString}"}, orderBy: createdAt, first: 1000) {
                id
                createdAt
                createdAtTx
                marketId
                marketAddress
            }
        }
    `;

	const response = await axios(
		"https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-goerli",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json"
			},
			data: JSON.stringify({
				query: betsQuery
			})
		}
	);
	return response.data.data.bets;
}

export function hydrateMarketId(
	marketId: string | DataHexString
): MarketDetails {
	const id = isHexString(marketId) ? bytes16HexToString(marketId) : marketId;
	const daysSinceEpoch = parseInt(marketId.slice(0, 6));
	//Convert daysSinceEpoch to date
	const date = new Date(daysSinceEpoch * 24 * 60 * 60 * 1000).getTime();
	const location = marketId.slice(6, 9);
	const race = parseInt(marketId.slice(9, 11));
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
