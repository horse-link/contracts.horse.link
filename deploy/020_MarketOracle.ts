import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const deployResult = await deploy("MarketOracle", {
		from: deployer,
		args: [],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
		//Redeploy if the script was called with "fresh" tag
		skipIfAlreadyDeployed: false
	});
	if (deployResult?.newlyDeployed) {
		console.log(
			`contract MarketOracle deployed at ${deployResult.address} using ${
				deployResult.receipt?.gasUsed ?? "?"
			} gas`
		);
	}
};
export default func;
func.tags = ["oracle"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
	return false;
};
