import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
/*
 * Deploy a Registry
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;

	const namedAccounts = await getNamedAccounts();
	const deployer = namedAccounts.deployer;
	const registryTokenAddress = "0xB84C7f03cad664dA6762A4a6b0E8bDc829Cb8622"; // hre.network.live
	// ? namedAccounts.HorseLink ?? namedAccounts.MockHorseLink
	// : (await hre.deployments.get("MockHorseLink")).address;

	console.log(`Deployer: ${deployer}`);

	const deployment = await deploy("Registry", {
		from: deployer,
		args: [registryTokenAddress],
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
				constructorArguments: [registryTokenAddress]
			});
		}, 20000);
	}
};

export default func;
func.tags = ["registry"];
func.dependencies = ["underlying"];
