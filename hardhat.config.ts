import { config as dotenvConfig } from "dotenv";
dotenvConfig();
//import "@nomiclabs/hardhat-etherscan";
//import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
//import "hardhat-contract-sizer";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";

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
			gasMultiplier: 1,
			tags: ["uat"]
		},
		arbitrumGoerli: {
			url: process.env.ARBITRUM_GOERLI_URL || defaultRpcUrl,
			accounts: [process.env.GOERLI_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY
				}
			},
			gasMultiplier: 1,
			tags: ["uat"]
		},
		arbitrum: {
			url: process.env.ARBITRUM_URL || defaultRpcUrl,
			accounts: [process.env.ARBITRUM_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY
				}
			},
			gasMultiplier: 1,
			tags: ["production"]
		},
		mainnet: {
			url: process.env.MAINNET_URL || defaultRpcUrl,
			accounts: [process.env.MAINNET_DEPLOYER || defaultKey],
			saveDeployment: true,
			tags: ["production"]
		}
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
			goerli: `privatekey://${process.env.GOERLI_DEPLOYER}`,
			arbitrumGoerli: `privatekey://${process.env.GOERLI_DEPLOYER}`,
			arbitrum: `privatekey://${process.env.ARBITRUM_DEPLOYER}`
		},
		faucet: {
			default: "0xF919eaF2E37aAC718Aa19668b9071ee42c02c081"
		},
		Usdt: {
			mainnet: "0xdac17f958d2ee523a2206206994597c13d831ec7",
			arbitrumGoerli: "0xE777Ce3a78Ef786Ca8d6eA60518DF71Cacd4BdAB"
		},
		Usdc: {
			mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
			arbitrum: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
		},
		fxAud: {
			arbitrum: "0x7E141940932E3D13bfa54B224cb4a16510519308"
		},
		fxUsd: {
			arbitrum: "0x8616E8EA83f048ab9A5eC513c9412Dd2993bcE3F"
		},
		HorseLink: {
			arbitrumGoerli: "0xe73Bab4b1955365F32EABabC2d2Ecac2A993604d"
		},
		Dai: {
			mainnet: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
			arbitrumGoerli: "0xdc1ac214959f46Cc6dB378f4E3d15ebdC6639540"
		},
		MarketSigner: {
			default: 1,
			goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden
			arbitrumGoerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden,
			arbitrum: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1" // key in bitwarden
		}
	},
	namedSigners: {
		deployer: {
			goerli: `${process.env.GOERLI_DEPLOYER}`,
			arbitrumGoerli: `${process.env.GOERLI_DEPLOYER}`,
			arbitrum: `${process.env.ARBITRUM_DEPLOYER}`
		}
	}
};
