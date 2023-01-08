import "@nomiclabs/hardhat-ethers";
import axios from "axios";
import "hardhat-deploy";
import { DeployFunction, Deployment } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Token } from "../deployData/settings";

/*
 * Deploy a Registry
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;

	const tokenDeployment: Deployment = await deployments.get("Token");
	const oracleDeployment: Deployment = await deployments.get("MarketOracle");
	const registryDeployment: Deployment = await deployments.get("Registry");

	if (!isVerfied(registryDeployment.address)) {
		console.log("Verifying Registry contract...");
		try {
			await hre.run("verify:verify", {
				address: tokenDeployment.address,
				constructorArguments: [Token.name, Token.symbol, Token.decimals ?? 18]
			});
		} catch (err) {
			console.log("Contract is already verified!");
		}
	}

	if (!isVerfied(oracleDeployment.address)) {
		console.log("Verifying Oracle contract...");
		try {
			await hre.run("verify:verify", {
				address: oracleDeployment.address
			});
		} catch (err) {
			console.log("Contract is already verified!");
		}
	}
};

const isVerfied = async (address: string) => {
	const url = `https://api-goerli.etherscan.io/api?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`;
	const response = await axios.get(url);
	return response.data.status === "0";
};

export default func;
func.tags = ["verify"];
func.dependencies = ["vault", "oracle", "token"];
