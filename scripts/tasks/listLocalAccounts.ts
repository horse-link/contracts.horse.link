import { task } from "hardhat/config";
import { ethers } from "hardhat";

task("accounts", "prints the list of accounts", async (agrs, hre) => {
  const accounts = await ethers.getSigners();
  for (const account of accounts) {
    const balance = hre.ethers.utils.formatEther(await account.getBalance());
    console.log(`${account.address} : ${balance} ETH`);
  }
});
