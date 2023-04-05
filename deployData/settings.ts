import { Token } from "../build/typechain";

export type TokenDeployDetails = {
	name: string;
	symbol?: string;
	decimals?: number;
	deploymentName: string;
	vaultName: string;
	marketName: string;
	mintAmount?: string;
	networks: string[];
	nftBaseUri: string;
	marketType: MarketType;
	owner?: string;
};

export enum MarketType {
	Simple = "Simple",
	Collateralised = "Collateralised"
}

export const mockTokens: TokenDeployDetails[] = [
	{
		name: "Mock USDT",
		symbol: "USDT",
		deploymentName: "Usdt",
		vaultName: "UsdtVault",
		marketName: "UsdtMarket",
		decimals: 6,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Collateralised,
		owner: "deployer",
		networks: ["hardhat", "localhost"]
	},
	{
		name: "Mock USDC",
		symbol: "USDC",
		deploymentName: "Usdc",
		vaultName: "UsdcVault",
		marketName: "UsdcMarket",
		decimals: 6,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Collateralised,
		owner: "deployer",
		networks: ["hardhat", "localhost"]
	},
	{
		name: "Mock fxAud",
		deploymentName: "fxAud",
		vaultName: "fxAUD Vault",
		marketName: "fxAUD Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "deployer",
		networks: ["hardhat", "localhost"]
	},
	{
		name: "Mock fxUsd",
		deploymentName: "fxUsd",
		vaultName: "fxUSD Vault",
		marketName: "fxUSD Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "deployer",
		networks: ["hardhat", "localhost"]
	}
];

export const productionTokens: TokenDeployDetails[] = [
	{
		name: "HorseLink",
		symbol: "HL",
		deploymentName: "HorseLink",
		vaultName: "HorseLinkVault",
		marketName: "HorseLinkMarket",
		decimals: 18,
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "lucas_cullen",
		networks: ["dev_arbitrum", "dev_goerli"]
	},
	{
		name: "Usdc",
		deploymentName: "Usdc",
		vaultName: "USDC Vault",
		marketName: "USDC Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "lucas_cullen",
		networks: ["prod_arbitrum", "dev_arbitrum"]
	},
	{
		name: "Usdt",
		deploymentName: "Usdt",
		vaultName: "USDT Vault",
		marketName: "USDT Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Collateralised,
		owner: "lucas_cullen",
		networks: ["prod_arbitrum", "dev_arbitrum"]
	},
	{
		name: "fxAud",
		deploymentName: "fxAud",
		vaultName: "fxAUD Vault",
		marketName: "fxAUD Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "lucas_cullen",
		networks: ["prod_arbitrum", "dev_arbitrum"]
	},
	{
		name: "fxUsd",
		deploymentName: "fxUsd",
		vaultName: "fxUSD Vault",
		marketName: "fxUSD Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "lucas_cullen",
		networks: ["prod_arbitrum", "dev_arbitrum", "prod_goerli"]
	}
];

export const UnderlyingTokens = [...mockTokens, ...productionTokens];

export const TestAccounts = [
	{
		address: "0x042BC2D085c0584Bd56D62C170C4679e1ee9FC45",
		prefundAmount: "100000"
	},
	{
		address: "0xD7E0f921E336b1DeCbaF65E9501d25B858322aEF",
		prefundAmount: "100000"
	},
	{
		address: "0x9E6d70d2F2328EE55128b65fad0bBd5D83F44D2b",
		prefundAmount: "1000000"
	},
	{
		address: "0x5F88eC396607Fc3edb0424E8E6061949e6b624e7",
		prefundAmount: "1000000"
	},
	{
		address: "0x8b503c95dC22F3F2b5d22BBA8a49451991EAF8c0",
		prefundAmount: "1000000"
	}
];
