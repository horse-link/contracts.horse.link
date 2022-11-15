import { getSignerForDeployer, verifyOnEtherscan } from "../utils";
import { MarketOracle, MarketOracle__factory } from "../../../build/typechain";
import { Contract } from "ethers";

export const contractNames = () => ["marketOracle"];

type MarketOracleContractorArgs = [];

const network = process.env.HARDHAT_NETWORK ?? "hardhat";

export const constructorArguments = (): MarketOracleContractorArgs => {
	return [];
};

export const deploy = async (deployer, setAddresses) => {
	console.log("deploying marketOracle");
	const signer = deployer ?? (await getSignerForDeployer());
	const factory = new MarketOracle__factory(signer);
	const args = constructorArguments();
	const contract = await factory.deploy(...args);
	await contract.deployTransaction.wait(1);
	console.log(`deployed marketOracle to address ${contract.address}`);
	setAddresses({ marketOracle: contract.address });
	//await verifyOnEtherscan(contract.address, args);
	return contract as Contract;
};
