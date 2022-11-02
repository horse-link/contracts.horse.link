import { BigNumberish, Contract } from "ethers";
import { Token__factory } from "../../../build/typechain";
import { getSignerForDeployer } from "../utils";

export const contractNames = () => ["erc20"];

export type ERC20ConstructorArguments = [string, string, BigNumberish];

export const constructorArguments = (): ERC20ConstructorArguments => [
  "TOKEN",
  "TKN",
  18
];

export const deploy = async (deployer, setAddresses) => {
  console.log("deploying ERC20");
  const signer = deployer ?? (await getSignerForDeployer());
  const erc20Factory = new Token__factory(signer);
  const args = constructorArguments();
  const contract = await erc20Factory.deploy(...args);
  await contract.deployTransaction.wait(1);
  console.log(`deployed ERC20 to address ${contract.address}`);
  setAddresses({ erc20: contract.address });
  //await verifyOnEtherscan(contract.address, args);
  return contract as Contract;
};
