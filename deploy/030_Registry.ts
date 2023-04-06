import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction, Deployment } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
/*
 * Deploy a Registry
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();
	let registryTokenDeployment: Deployment;
	try {
		registryTokenDeployment = await deployments.get("HorseLink");
	} catch {
		registryTokenDeployment = await deployments.get("MockHorseLink");
	}

	console.log(`Deployer: ${deployer}`);

	const deployment = await deploy("Registry", {
		from: deployer,
		args: [registryTokenDeployment.address],
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: false
	});
	if (hre.network.live) {
		// Verify
		// Wait 20 seconds
		setTimeout(async () => {
			await hre.run("verify:verify", {
				address: deployment.address,
				constructorArguments: [registryTokenDeployment.address]
			});
		}, 20000);
	}
};

export default func;
func.tags = ["registry"];
func.dependencies = ["underlying"];
