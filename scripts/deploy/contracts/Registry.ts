import { Registry__factory } from "../../../build/typechain";
import { getSignerForDeployer, verifyOnEtherscan } from "../utils";
import { ethers } from "hardhat";
import contracts from "../../../contracts.json";
import { BigNumberish, Contract } from "ethers";

export const contractNames = () => ["registry"];

type RegistryContractorArgs = [string];

const network = process.env.HARDHAT_NETWORK ?? "hardhat";

export const constructorArguments = (): RegistryContractorArgs => {
	const underlying = contracts[network].erc20;
	return [underlying];
};

export const deploy = async (deployer, setAddresses) => {
	console.log("deploying registry");
	const signer = deployer ?? (await getSignerForDeployer());
	const factory = new Registry__factory(signer);
	const args = constructorArguments();
	const contract = await factory.deploy(...args);
	await contract.deployTransaction.wait(5);
	console.log(`deployed registry to address ${contract.address}`);
	setAddresses({ registry: contract.address });
	//await verifyOnEtherscan(contract.address, args);
	return contract as Contract;
};
