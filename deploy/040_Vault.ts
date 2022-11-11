import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
import { UnderlyingTokens } from "../deployData/settings";
import { Token } from "../build/typechain/Token";

/*
 * Deploy a Vault contract with an Underlying ERC-20 token
 */

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute } = deployments;
	const namedAccounts = await getNamedAccounts();
	const deployer = namedAccounts.deployer;

	for (const tokenDetails of UnderlyingTokens) {
		let tokenAddress: string;
		if (network.tags.production || network.tags.uat) {
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			const tokenDeployment = await deployments.get(
				tokenDetails.deploymentName
			);
			tokenAddress = tokenDeployment.address;
		}
		const deployResult = await deploy(tokenDetails.vaultName, {
			contract: "Vault",
			from: deployer,
			args: [tokenAddress],
			log: true,
			autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
			skipIfAlreadyDeployed: false
		});

		if (deployResult.newlyDeployed) {
			// Add vault to registry
			await execute(
				"Registry",
				{ from: deployer, log: true },
				"addVault",
				deployResult.address
			);
		}
	}
};
export default func;
func.tags = ["vault"];
func.dependencies = ["registry"];
