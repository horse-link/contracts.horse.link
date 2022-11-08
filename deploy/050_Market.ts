import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";
/*
 * Deploy a Market contract with an Oracle
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();
  const oracle = await deployments.get("MarketOracle");
  const vault = await deployments.get("Vault");
  const marketDeployment = await deploy("Market", {
    from: deployer,
    args: [vault.address, 0, oracle.address],
    log: true,
    autoMine: true, 
    skipIfAlreadyDeployed: true
  });
  if (marketDeployment?.newlyDeployed) {
    //const vault: Vault = await ethers.getContract("Vault", deployer);
    await execute("Vault", { from: deployer, log: true }, "setMarket", marketDeployment.address, ethers.constants.MaxUint256)
  }
  if (!network.tags.test) {
    // Add market
    const registry = await deployments.get("Registry");
    await execute("Registry", { from: deployer, log: true }, "addMarket", marketDeployment.address);
  }
};
export default func;
func.tags = ["market"];
