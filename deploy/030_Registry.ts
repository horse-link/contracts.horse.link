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
	const registryTokenDeployment: Deployment = await deployments.get(
		"HorseLink"
	);

	await deploy("Registry", {
		from: deployer,
		args: [registryTokenDeployment.address],
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: false
	});
};

export default func;
func.tags = ["registry"];
func.dependencies = ["registryToken"];
