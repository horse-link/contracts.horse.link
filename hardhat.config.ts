import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";

import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";

import * as tdly from "@tenderly/hardhat-tenderly";
tdly.setup();

// @ts-ignore - Workaround for issue with Tenderly plugin failing to parse hardhat config https://github.com/Tenderly/tenderly-cli/issues/108
BigInt.prototype.toJSON = function () {
	return this.toString();
};

const defaultKey =
	"0000000000000000000000000000000000000000000000000000000000000001";
const defaultRpcUrl = "http://localhost:8545";

export default {
	gasReporter: {
		enabled: true,
		currency: "USD",
		// gasPrice: 21,
		showInChart: true,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY
	},
	paths: {
		sources: "./contracts",
		cache: "./cache",
		artifacts: "./artifacts",
		tests: "./tests",
		deploy: "./deploy",
		deployments: "./deployments",
		imports: "./imports"
	},
	networks: {
		hardhat: {
			chainId: 1337,
			saveDeployment: true,
			allowUnlimitedContractSize: true,
			tags: ["local", "testing"]
		},
		localhost: {
			url: defaultRpcUrl,
			saveDeployment: true,
			tags: ["local"]
		},
		goerli: {
			url: process.env.GOERLI_URL || defaultRpcUrl,
			accounts: [process.env.GOERLI_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY
				}
			},
			gasMultiplier: 2,
			//gasPrice: 50000000000,
			tags: ["uat"]
		},
		mainnet: {
			url: process.env.MAINNET_URL || defaultRpcUrl,
			accounts: [process.env.MAINNET_DEPLOYER || defaultKey],
			saveDeployment: true,
			tags: ["production"]
		}
	},
	tenderly: {
		username: "bazmati", // Temporary until the dltxio account is activated (support ticket raised)
		project: "hl", // project name
		privateVerification: false // if true, contracts will be verified privately, if false, contracts will be verified publicly
	},
	solidity: {
		compilers: [
			{
				version: "0.8.15",
				settings: {
					optimizer: {
						enabled: true,
						runs: 200
					}
				}
			}
		]
	},
	typechain: {
		outDir: "build/typechain",
		target: "ethers-v5",
		alwaysGenerateOverloads: false,
		externalArtifacts: ["externalArtifacts/*.json"]
	},
	namedAccounts: {
		deployer: {
			default: 0,
			goerli: `privatekey://${process.env.GOERLI_DEPLOYER}`
		},
		faucet: {
			default: "0xF919eaF2E37aAC718Aa19668b9071ee42c02c081"
		},
		Usdt: {
			mainnet: "0xdac17f958d2ee523a2206206994597c13d831ec7"
		},
		Usdc: {
			mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
		},
		Dai: {
			mainnet: "0x6B175474E89094C44Da98b954EedeAC495271d0F"
		},
		MarketSigner: {
			default: 1,
			goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1" // key in bitwarden
		}
	},
	namedSigners: {
		deployer: {
			goerli: `${process.env.GOERLI_DEPLOYER}`
		}
	}
};
