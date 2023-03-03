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

	// Get tokens we are using for the current network
	const underlyingTokens = UnderlyingTokens.filter((details) => {
		return details.networks.includes(network.name);
	});
	if (underlyingTokens.length == 0) {
		console.log("No underlying tokens found for network: ", network.name);
		return;
	}

	for (const tokenDetails of underlyingTokens) {
		let tokenAddress: string;

		// If the token has a named account, use that, otherwise get the address from the deployment
		if (namedAccounts[tokenDetails.deploymentName]) {
			console.log(
				"Using named account for token: ",
				tokenDetails.deploymentName
			);
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			console.log("Using deployment for token: ", tokenDetails.deploymentName);
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
		console.log(
			"Deployed vault: ",
			tokenDetails.vaultName,
			" at address: ",
			deployResult.address
		);

		if (deployResult.newlyDeployed && !network.tags.testing) {
			console.log("Adding vault to registry: ", tokenDetails.vaultName);
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
func.tags = ["vault"];
func.dependencies = ["registry"];
