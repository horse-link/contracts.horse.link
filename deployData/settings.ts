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
	}
];

export const RegistryToken = {
	name: "HorseLink",
	symbol: "HL",
	decimals: 18
};
