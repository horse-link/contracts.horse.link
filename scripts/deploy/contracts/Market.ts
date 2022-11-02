import { Market__factory } from "../../../build/typechain";
import { getSignerForDeployer, verifyOnEtherscan } from "../utils";
import { ethers } from "hardhat";
import contracts from "../../../contracts.json";
import { BigNumberish, Contract } from "ethers";

export const contractNames = () => ["market"];

type MarketContractorArgs = [string, BigNumberish, string];

const network = process.env.HARDHAT_NETWORK ?? "hardhat";

export const constructorArguments = (): MarketContractorArgs => {
  const vault = contracts[network].vault;
  const oracle = process.env.ORACLE_ADDRESS ?? ethers.constants.AddressZero;
  const fee = process.env.FEE ?? 0;
  return [vault, fee, oracle];
};

export const deploy = async (deployer, setAddresses) => {
  console.log("deploying Market");
  const signer = deployer ?? (await getSignerForDeployer());
  const factory = new Market__factory(signer);
  const args = constructorArguments();
  const contract = await factory.deploy(...args);
  await contract.deployTransaction.wait(1);
  console.log(`deployed Market to address ${contract.address}`);
  setAddresses({ market: contract.address });
  //await verifyOnEtherscan(contract.address, args);
  return contract as Contract;
};
