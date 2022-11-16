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
			if (!network.tags.testing) {
				await execute(
					"Registry",
					{ from: deployer, log: true },
					"addMarket",
					marketDeployment.address
				);
			}
		}
		// Local testing only
		// 1. Approve the Vault contract to spend the tokens
		// 2. Deposit a bunch of tokens
		if (!network.tags.production && !network.tags.testing) {
			const token: Token = await ethers.getContractAt("Token", tokenAddress);
			//get deployer signer from hardhat-deploy
			const signer = await ethers.getSigner(deployer);
			const receipt = await token
				.connect(signer)
				.approve(vaultDeployment.address, ethers.constants.MaxUint256);
			await receipt.wait();
			const balance = await token.balanceOf(signer.address);
			await execute(
				tokenDetails.vaultName,
				{
					from: deployer,
					log: true
				},
				"deposit",
				balance,
				deployer
			);
		}
	}
};
export default func;
func.tags = ["market"];
func.dependencies = ["vault", "oracle"];
