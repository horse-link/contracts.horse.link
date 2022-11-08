import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { parseEther } from "ethers/lib/utils";
import "hardhat-deploy";
import "@nomiclabs/hardhat-ethers";

/*
 * Deploy a test ERC-20 token to be used as an underlying token in the Vault contract
 * This is skipped if the network is not tagged as "test" in hardhat.config.ts
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const deployResult = await deploy("MarketOracle", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
    skipIfAlreadyDeployed: true
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
func.tags = ["oracle", "market"]; // Deploy if "oracle" or "market" tags are specified
