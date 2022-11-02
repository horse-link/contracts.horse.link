import {
  deployContract,
  getSignerForDeployer,
  verifyOnEtherscan
} from "../utils";
import { Vault, Vault__factory } from "../../../build/typechain";
import contracts from "../../../contracts.json";
import { Contract } from "ethers";

export const contractNames = () => ["vault"];

type VaultConstructorArgs = [string];
const network = process.env.HARDHAT_NETWORK ?? "hardhat";

export const constructorArguments = (): VaultConstructorArgs => {
  const erc20 = contracts[network].erc20;
  return [erc20];
};

export const deploy = async (deployer, setAddresses) => {
  console.log("deploying Vault");

  const network = process.env.HARDHAT_NETWORK ?? "hardhat";

  const signer = deployer ?? (await getSignerForDeployer());
  const factory = new Vault__factory(signer);
  const args = constructorArguments();
  const contract = await factory.deploy(...args);

  console.log(`deployed Vault to address ${contract.address}`);
  setAddresses({ vault: contract.address });

  //await verifyOnEtherscan(contract.address, args);
  return contract as Contract;
};
