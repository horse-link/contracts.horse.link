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
		arbitrum: {
			url: process.env.ARBITRUM_URL || defaultRpcUrl,
			accounts: [process.env.ARBITRUM_DEPLOYER || defaultKey],
			saveDeployment: true,
			gasMultiplier: 1,
			tags: ["production"]
		},
		sepolia: {
			chainId: 11155111,
			url: process.env.SEPOLIA_URL || defaultRpcUrl,
			accounts: [process.env.SEPOLIA_DEPLOYER || defaultKey],
			saveDeployment: true,
			tags: ["uat", "development", "dev"]
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
			sepolia: process.env.ETHERSCAN_API_KEY,
			development: process.env.ETHERSCAN_API_KEY,
			production: process.env.ARBISCAN_API_KEY
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
		lucas_cullen: {
			default: "0x9943d42D7a59a0abaE451130CcfC77d758da9cA0"
		},
		lucas_cullen2: {
			default: "0x05Ee13982bF0f31CC87b0ef2c9B54880aa712e06",
			name: "Lucas Ledger address [1], Ledger derivation"
		},
		horse_link: {
			default: "0x3Ebee18ce417Ac6f725FeB0A3649b2bE672A4448"
		},
		handle_fi: {
			default: "0xd7eD4FF9c8D82076fFEB1316CaB980Db9B771DE9"
		},
		deployer: {
			default: 0,
			development: `privatekey://${process.env.SEPOLIA_DEPLOYER}`,
			production: `privatekey://${process.env.ARBITRUM_DEPLOYER}`
		},
		faucet: {
			default: "0xF919eaF2E37aAC718Aa19668b9071ee42c02c081"
		},
		Usdc: {
			mainnet: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
			production: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
			development: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8"
		},
		Usdt: {
			production: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
			development: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
		},
		fxAud: {
			production: "0x7E141940932E3D13bfa54B224cb4a16510519308",
			development: "0x7E141940932E3D13bfa54B224cb4a16510519308"
		},
		fxUsd: {
			production: "0x8616E8EA83f048ab9A5eC513c9412Dd2993bcE3F",
			development: "0x8616E8EA83f048ab9A5eC513c9412Dd2993bcE3F"
		},
		HorseLink: {
			production: "0x06d0164b1bFb040D667a82C64De870dDeac38b86",
			development: "0x06d0164b1bFb040D667a82C64De870dDeac38b86"
		},
		MockHorseLink: {
			prod_goerli: "0xb8ff864683c2Bc75558B3F38257Cd05eE1CDB8F7", //Mock
			development: "0xb8ff864683c2Bc75558B3F38257Cd05eE1CDB8F7" //Mock
		},
		MockDai: {
			prod_goerli: "0x8D9A084b37E826d02040479911375Dc79C266684", //Mock
			development: "0x8D9A084b37E826d02040479911375Dc79C266684" //Mock
		},
		MockUsdt: {
			prod_goerli: "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229", //Mock
			development: "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229" //Mock
		},
		MarketSigner: {
			default: 1,
			prod_goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden
			dev_goerli: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden
			production: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1", // key in bitwarden,
			dev_arbitrum: "0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1" // key in bitwarden
		}
	},
	namedSigners: {
		deployer: {
			development: `${process.env.SEPOLIA_DEPLOYER}`,
			production: `${process.env.ARBITRUM_DEPLOYER}`
		}
	}
};
