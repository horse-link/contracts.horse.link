import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { UnderlyingTokens } from "../deployData/settings";

/*
 * Deploy a VaultTimeLock contract with an Underlying ERC-20 token
 */

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute } = deployments;
	const namedAccounts = await getNamedAccounts();
	const deployer = namedAccounts.deployer;

	for (const tokenDetails of UnderlyingTokens) {
		let tokenAddress: string;
		if (network.tags.production) {
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			const tokenDeployment = await deployments.get(
				tokenDetails.deploymentName
			);
			tokenAddress = tokenDeployment.address;
		}
		const deployResult = await deploy(tokenDetails.vaultName, {
			contract: "VaultTimeLock",
			from: deployer,
			args: [tokenAddress, process.env.VAULT_LOCK_TIME],
			log: true,
			autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
			skipIfAlreadyDeployed: false
		});

		if (deployResult.newlyDeployed && !network.tags.testing) {
			// Add vaultTimeLock to registry
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
func.tags = ["vaultTimeLock"];
func.dependencies = ["underlying", "registry"];
