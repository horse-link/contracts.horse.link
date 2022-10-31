import { ethers as tsEthers } from "ethers";
import { NFT__factory } from "../../../build/typechain";
import { NFT } from "../../../build/typechain";
import { BigNumberish } from "ethers";
import { getSignerForDeployer } from "../utils";

export const contractNames = () => ["nft"];

export type NftConstructorArguments = [
  string,
  string,
  BigNumberish,
  string,
  string
];

export const constructorArguments: () => NftConstructorArguments = () => [
  process.env.CONSTRUCTOR_NFT_NAME,
  process.env.CONSTRUCTOR_NFT_SYMBOL,
  process.env.CONSTRUCTOR_NFT_MAX,
  process.env.CONSTRUCTOR_NFT_FIXED_OWNER_ADDRESS,
  process.env.CONSTRUCTOR_NFT_BASE_URI
];

const deployNFT = async (
  constructorArguments: NftConstructorArguments,
  signer?: tsEthers.Signer,
  waitCount = 1
) => {
  signer = signer ?? (await getSignerForDeployer());
  const NFT = new NFT__factory(signer);
  const contract = await NFT.deploy(
    constructorArguments[0],
    constructorArguments[1],
    constructorArguments[2],
    constructorArguments[3],
    constructorArguments[4]
  );
  await contract.deployTransaction.wait(waitCount);
  return contract;
};

export const deploy = async (deployer, setAddresses) => {
  console.log("deploying NFT");
  const token: NFT = await deployNFT(constructorArguments(), deployer, 1);
  console.log(`deployed NFT to address ${token.address}`);
  setAddresses({ nft: token.address });
  return token;
};
