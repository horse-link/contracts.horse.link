import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';
import {ethers} from 'hardhat';
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

/*
* Deploy a Vault contract with an Underlying ERC-20 token
*/
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const {deployments, getNamedAccounts, network} = hre;
	const {deploy, execute} = deployments;
	const {deployer} = await getNamedAccounts();
    const oracle = deployer; // TODO: Put oracle address in .env
    const vaultDeployment = await deployments.get("Vault");
	const deployResult = await deploy("Market", {
		from: deployer,
		args: [vaultDeployment.address, 0, oracle],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
        skipIfAlreadyDeployed: true,
	});
    if (deployResult?.newlyDeployed) {
        // Allow the Market to withdraw from the Vault
        execute("Vault", {from: deployer, log: true}, "approve", [deployResult.address, ethers.constants.MaxUint256]);
    }

};
export default func;
func.tags = ['market']; 