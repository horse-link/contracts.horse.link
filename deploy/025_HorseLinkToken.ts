import "@nomiclabs/hardhat-ethers";
import { parseEther } from "ethers/lib/utils";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Token } from "../deployData/settings";

/*
 * Deploy a test ERC-20 token to be used as the governance token for a Registry contract
 * The token will not be redeployed unless the "fresh" tag is used
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, execute } = deployments;
	const { deployer } = await getNamedAccounts();

	const deployResult = await deploy("Token", {
		contract: "Token",
		from: deployer,
		args: [Token.name, Token.symbol, Token.decimals ?? 18],
		log: true,
		autoMine: true, //If test environment, speed up deployment by mining the block immediately
		skipIfAlreadyDeployed: false
	});
	if (deployResult?.newlyDeployed) {
		console.log(
			`Token deployed at ${deployResult.address} using ${
				deployResult.receipt?.gasUsed ?? "?"
			} gas`
		);
		await execute(
			"Token",
			{ from: deployer, log: true },
			"mint",
			deployer,
			parseEther("1000000000")
		);
	}

	// await hre.run("verify:verify", {
	// 	address: deployResult.address,
	// 	constructorArguments: [
	// 		Token.name,
	// 		Token.symbol,
	// 		Token.decimals ?? 18
	// 	],
	// });
};
export default func;
func.tags = ["token"];
