import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import "solidity-coverage";
import "hardhat-deploy-tenderly";

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

		// Production
		prod_goerli: {
			url: process.env.GOERLI_URL || defaultRpcUrl,
			accounts: [process.env.GOERLI_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY
				}
			},
			gasMultiplier: 2,
			tags: ["production"]
		},
		prod_arbitrum: {
			url: process.env.ARBITRUM_URL || defaultRpcUrl,
			accounts: [process.env.ARBITRUM_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ARBISCAN_API_KEY
				}
			},
			gasMultiplier: 1,
			tags: ["production"]
		},

		// Staging / Development
		dev_arbitrum: {
			url: process.env.ARBITRUM_URL || defaultRpcUrl,
			accounts: [process.env.ARBITRUM_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ARBISCAN_API_KEY
				}
			},
			gasMultiplier: 1,
			tags: ["uat"]
		},
		dev_goerli: {
			url: process.env.GOERLI_URL || defaultRpcUrl,
			accounts: [process.env.GOERLI_DEPLOYER || defaultKey],
			saveDeployment: true,
			verify: {
				etherscan: {
					apiKey: process.env.ETHERSCAN_API_KEY
				}
			},
			tags: ["uat"]
		}
	},
	tenderly: {
		username: "dltxio",
		project: "hl", // project name
		privateVerification: false // if true, contracts will be verified privately, if false, contracts will be verified publicly
	},
	etherscan: {
		apiKey: {
			arbitrumOne: process.env.ARBISCAN_API_KEY,
			goerli: process.env.ETHERSCAN_API_KEY,
			dev_arbitrum: process.env.ARBISCAN_API_KEY,
			prod_arbitrum: process.env.ARBISCAN_API_KEY,
			prod_goerli: process.env.ETHERSCAN_API_KEY,
			dev_goerli: process.env.ETHERSCAN_API_KEY
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
			dev_goerli: `privatekey://${process.env.GOERLI_DEPLOYER}`,
			prod_goerli: `privatekey://${process.env.GOERLI_DEPLOYER}`,
			dev_arbitrum: `privatekey://${process.env.ARBITRUM_DEPLOYER}`,
			prod_arbitrum: `privatekey://${process.env.ARBITRUM_DEPLOYER}`
		},
		faucet: {
			default: "0xF919eaF2E37aAC718Aa19668b9071ee42c02c081"
		},
		Usdc: {
			mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
			prod_arbitrum: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
		},
		fxAud: {
			prod_arbitrum: "0x7E141940932E3D13bfa54B224cb4a16510519308"
		},
		fxUsd: {
			prod_arbitrum: "0x8616E8EA83f048ab9A5eC513c9412Dd2993bcE3F"
		},
		HorseLink: {
			prod_arbitrum: "0x06d0164b1bFb040D667a82C64De870dDeac38b86",
			dev_arbitrum: "0x06d0164b1Bfb040D667A82c64DE870DDEac38b86"
		},
		Dai: {
			prod_goerli: "0x8D9A084b37E826d02040479911375Dc79C266684",
			dev_goerli: "0x8D9A084b37E826d02040479911375Dc79C266684"
		},
		Usdt: {
			prod_goerli: "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229",
			dev_goerli: "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229"
		},
		MarketSigner: {
			default: 1,
			prod_goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden
			dev_goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden
			prod_arbitrum: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden,
			dev_arbitrum: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1" // key in bitwarden
		}
	},
	namedSigners: {
		deployer: {
			prod_goerli: `${process.env.GOERLI_DEPLOYER}`,
			dev_goerli: `${process.env.GOERLI_DEPLOYER}`,
			prod_arbitrum: `${process.env.ARBITRUM_DEPLOYER}`,
			dev_arbitrum: `${process.env.ARBITRUM_DEPLOYER}`
		}
	}
};
