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
	mock?: boolean;
};

export enum MarketType {
	Simple = "Market",
	Collateralised = "MarketCollateralisedLinear"
}

export const mockTokens: TokenDeployDetails[] = [
	{
		name: "Mock HorseLink",
		symbol: "mHL",
		deploymentName: "MockHorseLink",
		vaultName: "MockHorseLinkVault",
		marketName: "MockHorseLinkMarket",
		decimals: 18,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "deployer",
		mock: true,
		networks: [
			"hardhat",
			"localhost",
			"dev_goerli",
			"prod_goerli",
			"dev_arbitrum"
		]
	},
	{
		name: "Mock USDT",
		symbol: "mUSDT",
		deploymentName: "MockUsdt",
		vaultName: "MockUsdtVault",
		marketName: "MockUsdtMarket",
		decimals: 6,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Collateralised,
		owner: "deployer",
		mock: true,
		networks: ["hardhat", "localhost", "dev_goerli", "prod_goerli"]
	},
	{
		name: "Mock USDC",
		symbol: "mUSDC",
		deploymentName: "MockUsdc",
		vaultName: "MockUsdcVault",
		marketName: "MockUsdcMarket",
		decimals: 6,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Collateralised,
		owner: "deployer",
		mock: true,
		networks: ["hardhat"]
	},
	{
		name: "Mock fxAud",
		symbol: "mFxAUD",
		deploymentName: "MockFxAud",
		vaultName: "MockFxAudVault",
		marketName: "MockFxAudMarket",
		decimals: 18,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "deployer",
		mock: true,
		networks: ["hardhat", "localhost"]
	},
	{
		name: "Mock fxUsd",
		symbol: "mFxUSD",
		deploymentName: "MockFxUsd",
		vaultName: "MockFxUsdVault",
		marketName: "MockFxUsdMarket",
		decimals: 18,
		mintAmount: "1000000000",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "deployer",
		mock: true,
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
		owner: "horse_link",
		networks: []
	},
	{
		name: "Usdc",
		deploymentName: "Usdc",
		vaultName: "USDC Vault",
		marketName: "USDC Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "horse_link",
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
		owner: "handle_fi",
		networks: ["prod_arbitrum", "dev_arbitrum"]
	},
	{
		name: "fxUsd",
		deploymentName: "fxUsd",
		vaultName: "fxUSD Vault",
		marketName: "fxUSD Market",
		nftBaseUri: "https://horse.link/api/nft/",
		marketType: MarketType.Simple,
		owner: "handle_fi",
		networks: ["prod_arbitrum", "dev_arbitrum"]
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
