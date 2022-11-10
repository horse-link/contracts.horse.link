import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { UnderlyingTokens } from "../deployData/settings";
/*
 * Deploy a Market contract with an Oracle
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute } = deployments;

	const oracle = await deployments.get("MarketOracle");
	const namedAccounts = await getNamedAccounts();
	const deployer = namedAccounts.deployer;

	for (const tokenDetails of UnderlyingTokens) {
		//const tokenDeployment = await deployments.get(
		//	tokenDetails.deploymentName
		//);
		const vaultDeployment = await deployments.get(tokenDetails.vaultName);
		//let tokenAddress: string;
		//if (network.tags.production || network.tags.uat) {
		//	tokenAddress = namedAccounts[tokenDetails.deploymentName];
		//} else {
		//	tokenAddress = tokenDeployment.address;
		//}
		const deployResult = await deploy(tokenDetails.marketName, {
			contract: "Market",
			from: deployer,
			args: [vaultDeployment.address, 0, oracle.address],
			log: true,
			autoMine: true,
			skipIfAlreadyDeployed: false
		});
		if (deployResult?.newlyDeployed) {
			await execute(
				tokenDetails.vaultName,
				{ from: deployer, log: true },
				"setMarket",
				deployResult.address,
				ethers.constants.MaxUint256
			);
		}
		// Add market to registry
		//const registry = await deployments.get("Registry");
		await execute(
			"Registry",
			{ from: deployer, log: true },
			"addMarket",
			deployResult.address
		);
	}
};
export default func;
func.tags = ["market"];
func.dependencies = ["vault", "oracle"];
