import { task } from "hardhat/config";
import { ethers } from "ethers";

task("accounts", "prints the list of accounts", async (agrs, hre) => {
  const accounts: ethers.Signer[] = await hre.ethers.getSigners();
  for (const account of accounts) {
    const address = await account.getAddress();
    const balance = hre.ethers.utils.formatEther(await account.getBalance());
    console.log(`${address} : ${balance} ETH`);
  }
});
