
//import "@nomiclabs/hardhat-etherscan";
//import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
import "@typechain/hardhat";
//import "hardhat-contract-sizer";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
//import "hardhat-gas-reporter";
//import "solidity-coverage";
//import "./scripts/tasks";

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

const defaultKey =
  "0000000000000000000000000000000000000000000000000000000000000001";
const defaultRpcUrl = "http://localhost:8545";

export default {
  gasReporter: {
    enabled: true,
    currency: "ETH",
    gasPrice: "auto",
    showInChart: true
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
      allowUnlimitedContractSize: false,
      saveDeployment: false,
      tags: ["local", "test"]
    },
    localhost: {
      url: defaultRpcUrl,
      accounts: [process.env.PRIVATE_KEY || defaultKey],
      saveDeployment: false,
      tags: ["local"],
    },
    goerli: {
      url: process.env.GOERLI_URL || defaultRpcUrl,
      accounts: [process.env.PRIVATE_KEY || defaultKey],
      saveDeployment: true,
      tags: ["staging"]
    },
    mainnet: {
      url: process.env.MAINNET_URL || defaultRpcUrl,
      accounts: [process.env.PRIVATE_KEY || defaultKey],
      saveDeployment: true,
      tags: ["production"]
    }
  },
  solidity: {
    compilers: [
      {
        version: "0.8.10",
        settings: {
          optimizer: {
            enabled: false,
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
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_KEY
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
      goerli: process.env.GOERLI_DEPLOYER,
    },
    usdt: {
      default: 1,
      mainnet: "TODO",
      goerli: "TODO",
    },
    usdc: {

    },
    dai: {
    },
    forex: {     
    }

  }
};
