export type TokenDeployDetails = {
	name: string;
	symbol: string;
	decimals: number;
	deploymentName: string;
	vaultName: string;
	marketName: string;
	mintAmount: string;
};

export const UnderlyingTokens: TokenDeployDetails[] = [
	{
		name: "Mock USDT",
		symbol: "USDT",
		deploymentName: "Usdt",
		vaultName: "UsdtVault",
		marketName: "UsdtMarket",
		decimals: 6,
		mintAmount: "1000000000"
	},
	{
		name: "Mock DAI",
		symbol: "DAI",
		deploymentName: "Dai",
		vaultName: "DaiVault",
		marketName: "DaiMarket",
		decimals: 18,
		mintAmount: "1000000000"
	},
	{
		name: "Mock HorseLink",
		symbol: "HL",
		deploymentName: "HorseLink",
		vaultName: "HorseLinkVault",
		marketName: "HorseLinkMarket",
		decimals: 18,
		mintAmount: "1000000000"
	}
];

export const RegistryToken = {
	name: "HorseLink",
	symbol: "HL",
	decimals: 18
};

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
	}
];
