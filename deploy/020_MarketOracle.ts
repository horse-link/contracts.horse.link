import "@nomiclabs/hardhat-ethers";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy } = deployments;
	const { deployer } = await getNamedAccounts();

	const signatureLib = await deploy("SignatureLib", {
		contract: "SignatureLib",
		from: deployer,
		log: true,
		autoMine: true,
		skipIfAlreadyDeployed: true
	});

	const deployResult = await deploy("MarketOracle", {
		from: deployer,
		args: [],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
		libraries: {
			SignatureLib: signatureLib.address
		},
		skipIfAlreadyDeployed: false
	});
	if (deployResult?.newlyDeployed) {
		console.log(
			`contract MarketOracle deployed at ${deployResult.address} using ${
				deployResult.receipt?.gasUsed ?? "?"
			} gas`
		);
		if (!hre.network.tags.testing) {
			// Verify
			setTimeout(async () => {
				await hre.run("verify:verify", {
					address: deployResult.address,
					constructorArguments: []
				});
			}, 30000);
		}
	}
};
export default func;
func.tags = ["oracle"];
