import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction, DeployResult } from "hardhat-deploy/types";
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

	console.log(`Deployer: ${deployer}`);

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

		const locktime = process.env.VAULT_LOCK_TIME || 30;
		const constructorArguments = [tokenAddress, locktime];
		const deployResult: DeployResult = await deploy(tokenDetails.vaultName, {
			contract: "VaultTimeLock",
			from: deployer,
			args: constructorArguments,
			log: true,
			autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
			skipIfAlreadyDeployed: true
		});
		console.log(
			"Deployed vault: ",
			tokenDetails.vaultName,
			" at address: ",
			deployResult.address
		);

		if (!network.tags.testing) {
			// Don't add to registry if running unit tests
			console.log("Adding vault to registry: ", tokenDetails.vaultName);
			// Add vaultTimeLock to registry
			try {
				await execute(
					"Registry",
					{ from: deployer, log: true },
					"addVault",
					deployResult.address
				);
			} catch (error) {
				console.log("Error adding vault to registry: ", error);
			}
		}
		if (network.live) {
			// Verify
			// Wait 10 seconds
			setTimeout(async () => {
				await hre.run("verify:verify", {
					address: deployResult.address,
					constructorArguments
				});
			}, 10000);
		}
	}
};
export default func;
func.tags = ["vault"];
func.dependencies = ["registry"];
