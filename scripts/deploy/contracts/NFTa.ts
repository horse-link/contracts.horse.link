import { NFTa } from "../../../build/typechain";
import { ethers as tsEthers } from "ethers";
import { NFTa__factory } from "../../../build/typechain";
import { getSignerForDeployer } from "../utils";

export const contractNames = () => ["nftA"];

export type NftAConstructorArguments = [string, string];

const deployNFTa = async (
  constructorArguments: NftAConstructorArguments,
  signer?: tsEthers.Signer,
  waitCount = 1
) => {
  signer = signer ?? (await getSignerForDeployer());
  const NFTa = new NFTa__factory(signer);
  const contract = await NFTa.deploy(
    constructorArguments[0],
    constructorArguments[1]
  );
  await contract.deployTransaction.wait(waitCount);
  return contract;
};

export const constructorArguments: () => NftAConstructorArguments = () => [
  process.env.CONSTRUCTOR_NFT_A_NAME,
  process.env.CONSTRUCTOR_NFT_A_SYMBOL
];

export const deploy = async (deployer, setAddresses) => {
  console.log("deploying NFTa");
  const token: NFTa = await deployNFTa(constructorArguments(), deployer, 1);
  console.log(`deployed NFTa to address ${token.address}`);
  setAddresses({ nfta: token.address });
  return token;
};
