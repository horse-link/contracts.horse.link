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
    const tokenDeployment = await deployments.get("Token");
	const deployResult = await deploy("Vault", {
		from: deployer,
		args: [tokenDeployment.address],
		log: true,
		autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
        skipIfAlreadyDeployed: true,
	});
    if (deployResult?.newlyDeployed) {
        // If this is a test network, deposit some tokens
        // 1. Approve
        // 2. Deposit
        if (network.tags.test) {          
            execute("Token", {from: deployer, log: true}, "approve", [deployResult.address, ethers.constants.MaxUint256]);
            execute("Vault", {from: deployer, log: true}, "deposit", [parseEther("1000000000")]); //TODO: Put this constant in .env
            console.log("Deposited tokens into Vault");
        }
    }

};
export default func;
func.tags = ['vault']; // Deploy if "vault"