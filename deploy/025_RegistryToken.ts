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

    const deployResult = await deploy("RegistryToken", {
        contract: "Token",
        from: deployer,
        args: ["HorseLink", "HL", 18],
        log: true,
        autoMine: true,
        skipIfAlreadyDeployed: true
    });
    if (deployResult?.newlyDeployed) {
        console.log(
            `RegistryToken deployed at ${deployResult.address} using ${deployResult.receipt?.gasUsed ?? "?"
            } gas`
        );
        await execute(
            "RegistryToken",
            { from: deployer, log: true },
            "mint",
            deployer,
            parseEther("1000000000")
        );
    }
};
export default func;
func.tags = ["registry"]; 
