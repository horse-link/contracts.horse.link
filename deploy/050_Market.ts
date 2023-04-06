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
	const { deploy, execute, read } = deployments;
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

	const registryDeployment = await deployments.get("Registry");

	// Get tokens we are using for the current network
	const underlyingTokens = UnderlyingTokens.filter((details) => {
		return details.networks.includes(network.name);
	});

	for (const tokenDetails of underlyingTokens) {
		const vaultName = tokenDetails.vaultName;
		const marketName = tokenDetails.marketName;
		const vaultDeployment = await deployments.get(tokenDetails.vaultName);
		let tokenAddress: string;
		const constructorArguments = [
			vaultDeployment.address,
			0,
			timeoutDays,
			oracle.address,
			`${tokenDetails.nftBaseUri}/${hre.network.name}/${registryDeployment.address}/${tokenDetails.symbol}/` // This is enough to allow us to derive the correct market contract and return useful metadata
		];

		// If the token has a named account, use that, otherwise get the address from the deployment
		// Warn if there is a named account AND a deployment
		if (namedAccounts[tokenDetails.deploymentName]) {
			console.log(
				"Using named account for token: ",
				tokenDetails.deploymentName
			);
			tokenAddress = namedAccounts[tokenDetails.deploymentName];
		} else {
			console.log("Using deployment for token: ", tokenDetails.deploymentName);
			const tokenDeployment = await deployments.get(
				tokenDetails.deploymentName
			);
			tokenAddress = tokenDeployment.address;
		}
		const marketDeployment = await deploy(marketName, {
			contract: tokenDetails.marketType,
			from: deployer,
			args: constructorArguments,
			log: true,
			autoMine: true,
			skipIfAlreadyDeployed: false,
			libraries: {
				SignatureLib: signatureLib.address,
				OddsLib: oddsLib.address
			}
		});

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
			//Check to see if the market has already been added
			const result = await read("Registry", "getMarket", tokenAddress);
			try {
				await execute(
					"Registry",
					{ from: deployer, log: true },
					"addMarket",
					marketDeployment.address
				);
			} catch (e) {
				console.warn("Market already added");
			}
		}
		if (network.live) {
			// Wait 10 seconds before verifying
			setTimeout(async () => {
				hre
					.run("verify:verify", {
						address: marketDeployment.address,
						constructorArguments
					})
					.catch((e) => {
						console.log("Error verifying market: ", e);
					});
			}, 10000);

			if (namedAccounts[tokenDetails.owner]) {
				await execute(
					marketName,
					{ from: deployer, log: true },
					"transferOwnership",
					namedAccounts[tokenDetails.owner]
				);
			}
		}

		// Deposit some tokens into the vault
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
	if (network.live) {
		await hre.run("verify:verify", {
			address: oddsLib.address,
			constructorArguments: []
		});
		await hre.run("verify:verify", {
			address: signatureLib.address,
			constructorArguments: []
		});
	}
};
export default func;
func.tags = ["market"];
func.dependencies = ["vault", "oracle"];
