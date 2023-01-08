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
	const tokenDeployment: Deployment = await deployments.get("Token");

	const deploymentResult = await deploy("Registry", {
		from: deployer,
		args: [tokenDeployment.address],
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: false
	});

	// await hre.run("verify:verify", {
	// 	address: deploymentResult.address,
	// 	constructorArguments: [deploymentResult.address]
	// });
};

export default func;
func.tags = ["registry"];
func.dependencies = ["token"];
