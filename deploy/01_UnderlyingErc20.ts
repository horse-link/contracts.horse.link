import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts} = hre;
	const {deploy} = deployments;
	const {deployer, simpleERC20Beneficiary} = await getNamedAccounts();
	const deployResult = await deploy('Token', {
		from: deployer,
		args: [deployer, parseEther('1000000000')],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
        skipIfAlreadyDeployed: true,
	});
    if (deployResult.newlyDeployed) {
        console.log(
            `contract Token deployed at ${deployResult.address} using ${deployResult.receipt.gasUsed} gas`
        );
    }
};
export default func;
func.tags = ['vault', 'underlying']; // Deploy if "vault" or "underlying" tags are specified