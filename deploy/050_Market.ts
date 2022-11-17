import "@nomiclabs/hardhat-ethers";
import { ethers } from "hardhat";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Token } from "../build/typechain";
import { UnderlyingTokens } from "../deployData/settings";
/*
 * Deploy a Market contract with an Oracle
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts, network } = hre;
	const { deploy, execute } = deployments;

	const oracle = await deployments.get("MarketOracle");
	const namedAccounts = await getNamedAccounts();
	const deployer = namedAccounts.deployer;

	for (const tokenDetails of UnderlyingTokens) {
		const vaultDeployment = await deployments.get(tokenDetails.vaultName);
		let tokenAddress: string;
		if (network.tags.production || network.tags.uat) {
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			const tokenDeployment = await deployments.get(
				tokenDetails.deploymentName
			);
			tokenAddress = tokenDeployment.address;
		}
		const marketDeployment = await deploy(tokenDetails.marketName, {
			contract: "Market",
			from: deployer,
			args: [vaultDeployment.address, 0, oracle.address],
			log: true,
			autoMine: true,
			skipIfAlreadyDeployed: false
		});
		if (marketDeployment?.newlyDeployed) {
			await execute(
				tokenDetails.vaultName,
				{ from: deployer, log: true },
				"setMarket",
				marketDeployment.address,
				ethers.constants.MaxUint256
			);
			if (!network.tags.local) {
				await execute(
					"Registry",
					{ from: deployer, log: true },
					"addMarket",
					marketDeployment.address
				);
			}
		}

		const token: Token = await ethers.getContractAt("Token", tokenAddress);
		if (!network.tags.production) {
			const signer = await ethers.getSigner(deployer);
			const receipt = await token
				.connect(signer)
				.approve(vaultDeployment.address, ethers.constants.MaxUint256);
			await receipt.wait();
		}
		if (!network.tags.production && !network.tags.testing) {
			const balance = await token.balanceOf(deployer);
			await execute(
				tokenDetails.vaultName,
				{
					from: deployer,
					log: true
				},
				"deposit",
				balance.div(2),
				deployer
			);
		}
	}
};
export default func;
func.tags = ["market"];
func.dependencies = ["vault", "oracle"];
