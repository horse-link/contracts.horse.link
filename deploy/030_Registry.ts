import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction, Deployment } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
/*
 * Deploy a Registry
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const registryTokenDeployment: Deployment = await deployments.get(
    "RegistryToken"
  );

  await deploy("Registry", {
    from: deployer,
    args: [registryTokenDeployment.address],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false
  });
};

export default func;
func.tags = ["registry"];
func.dependencies = ["registryToken"];
