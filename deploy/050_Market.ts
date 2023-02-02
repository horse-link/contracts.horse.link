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
	const timeoutDays = network.tags.production ? 5 : 1; // 5 days in production, otherwise 1 day

	const signatureLib = await deploy("SignatureLib", {
		contract: "SignatureLib",
		from: deployer,
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: true
	});

	const oddsLib = await deploy("OddsLib", {
		contract: "OddsLib",
		from: deployer,
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: true
	});

	const collateralised = true;
	for (const tokenDetails of UnderlyingTokens) {
		const vaultName = tokenDetails.vaultName;
		const marketName = tokenDetails.marketName;
		const vaultDeployment = await deployments.get(tokenDetails.vaultName);
		let tokenAddress: string;
		if (network.tags.production) {
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			const tokenDeployment = await deployments.get(
				tokenDetails.deploymentName
			);
			tokenAddress = tokenDeployment.address;
		}
		const marketDeployment = await deploy(marketName, {
			contract: collateralised ? "MarketCollateralisedLinear" : "Market",
			from: deployer,
			args: [vaultDeployment.address, 0, timeoutDays, oracle.address],
			log: true,
			autoMine: true,
			skipIfAlreadyDeployed: false,
			libraries: {
				SignatureLib: signatureLib.address,
				OddsLib: oddsLib.address
			}
		});
		if (marketDeployment?.newlyDeployed) {
			await execute(
				vaultName,
				{ from: deployer, log: true },
				"setMarket",
				marketDeployment.address,
				ethers.constants.MaxUint256
			);
			await execute(
				marketName,
				{ from: deployer, log: true },
				"grantSigner",
				namedAccounts.MarketSigner
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

		const token: Token = await ethers.getContractAt("Token", tokenAddress);
		if (!network.tags.production && !network.tags.testing) {
			const token: Token = await ethers.getContractAt("Token", tokenAddress);

			//Allow the Vault to spend the Deployer's tokens
			const signer = await ethers.getSigner(deployer);
			console.log(
				`Approving Vault to spend tokens for deployer ${signer.address}`
			);
			const receipt = await token
				.connect(signer)
				.approve(vaultDeployment.address, ethers.constants.MaxUint256);
			await receipt.wait();

			const balance = await token.balanceOf(signer.address);
			await execute(
				vaultName,
				{
					from: deployer,
					log: true
				},
				"deposit",
				balance.div(100000),
				deployer
			);
		}
	}
};
export default func;
func.tags = ["market"];
func.dependencies = ["vault", "oracle"];
