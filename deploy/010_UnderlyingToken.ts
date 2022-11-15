import "@nomiclabs/hardhat-ethers";
import { parseEther } from "ethers/lib/utils";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { UnderlyingTokens } from "../deployData/settings";

/*
 * Deploy a test ERC-20 token to be used as an underlying token in the Vault contract
 * This is skipped if the network is not tagged as "test" in hardhat.config.ts
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, execute } = deployments;
	const { deployer } = await getNamedAccounts();

	for (const tokenDetails of UnderlyingTokens) {
		const underlying = await deploy(tokenDetails.deploymentName, {
			contract: "Token",
			from: deployer,
			args: [
				tokenDetails.name,
				tokenDetails.symbol,
				tokenDetails.decimals
			],
			log: true,
			autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
			skipIfAlreadyDeployed: true
		});

		if (underlying.newlyDeployed) {
			console.log(
				`${tokenDetails.symbol} deployed at ${underlying.address}`
			);
			await execute(
				tokenDetails.deploymentName,
				{ from: deployer, log: true },
				"mint",
				deployer,
				parseEther(tokenDetails.mintAmount)
			);
			console.log(
				`Minted ${tokenDetails.mintAmount} ${tokenDetails.symbol} to deployer`
			);
		}
	}
};
export default func;
func.tags = ["underlying"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
	return !hre.network.tags.test;
};
