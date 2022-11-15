import "@nomiclabs/hardhat-ethers";
import { parseEther } from "ethers/lib/utils";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { RegistryToken } from "../deployData/settings";

/*
 * Deploy a test ERC-20 token to be used as an underlying token in the Vault contract
 * The token will not be redeployed unless the "fresh" tag is used
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, execute } = deployments;
	const { deployer } = await getNamedAccounts();

	const deployResult = await deploy("RegistryToken", {
		contract: "Token",
		from: deployer,
		args: [
			RegistryToken.name,
			RegistryToken.symbol,
			RegistryToken.decimals ?? 18
		],
		log: true,
		autoMine: true, //If test environment, speed up deployment by mining the block immediately
		skipIfAlreadyDeployed: false
	});
	if (deployResult?.newlyDeployed) {
		console.log(
			`RegistryToken deployed at ${deployResult.address} using ${
				deployResult.receipt?.gasUsed ?? "?"
			} gas`
		);
		await execute(
			"RegistryToken",
			{ from: deployer, log: true },
			"mint",
			deployer,
			parseEther("1000000000")
		);
	}
};
export default func;
func.tags = ["registryToken", "token"];
