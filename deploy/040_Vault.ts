import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

/*
 * Deploy a Vault contract with an Underlying ERC-20 token
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute } = deployments;
	const { deployer } = await getNamedAccounts();
	const tokenDeployment = await deployments.get("Token");
	const deployResult = await deploy("Vault", {
		from: deployer,
		args: [tokenDeployment.address],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
		skipIfAlreadyDeployed: true
	});
	if (deployResult?.newlyDeployed) {
		// If this is a test network, deposit some tokens
		// 1. Approve the Vault contract to spend the tokens
		// 2. Deposit
		if (network.tags.test) {
			await execute(
				"Token",
				{
					from: deployer,
					log: true
				},
				"approve",
				deployResult.address,
				ethers.constants.MaxUint256
			);
		} else {
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
func.tags = ["vault"]; // Deploy if "vault"
