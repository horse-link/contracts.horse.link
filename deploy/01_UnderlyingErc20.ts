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

  const deployResult = await deploy("Token", {
    from: deployer,
    args: ["USDT", "Mock USDT", 18],
    log: true,
    autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
    skipIfAlreadyDeployed: true
  });
  if (deployResult?.newlyDeployed) {
    console.log(
      `contract Token deployed at ${deployResult.address} using ${
        deployResult.receipt?.gasUsed ?? "?"
      } gas`
    );
    await execute(
      "Token",
      { from: deployer, log: true },
      "mint",
      deployer,
      parseEther("1000000000")
    );
  }
};
export default func;
func.tags = ["vault", "underlying"]; // Deploy if "vault" or "underlying" tags are specified
func.skip = async (hre: HardhatRuntimeEnvironment) => {
  // Skip if this not a test deployment
  return !hre.network.tags.test;
};
