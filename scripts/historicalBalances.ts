// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

//import hre, { ethers } from "hardhat";
//import Usdt.json
import * as deployment from "../deployments/goerli/Usdt.json";
const erc20Abi = deployment.abi;

// Import ABI from

async function main() {
	//const erc20Address = "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229";
	//const vaultAddress =  "0x218E7147c3ac5ecC78AAb8258256b114624b768E";
	//const marketAddress = "0xE700AaAad0918d7650bc512c7C079b413466Ea6c";
	const data = {
		goerli: {
			erc20Address: "0x218E7147c3ac5ecC78AAb8258256b114624b768E",
			vaultAddress: "0xF9F36C66854010D61e8F46F9Cc46F9ed55996229",
			marketAddress: "0xE700AaAad0918d7650bc512c7C079b413466Ea6c",
			startBlock: 8652000,
			interval: 1000
		},
		arbitrum: {
			erc20Address: "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8",
			vaultAddress: "0xBd85FA3a3A2E2B5e252262dEE2875C5A096E10CF",
			marketAddress: "0xD257881dc3e26F25b95495a57F5A03E704F50B5c",
			startBlock: 75075679, //75075679, //70275679,
			interval: 1000
		}
	};

	const settings = data[hre.network.name];
	console.log(JSON.stringify(settings, null, 2));

	console.log("Block,Vault Balance,Market Balance");

	const endBlock = await ethers.provider.getBlockNumber();

	for (
		let blockNum = settings.startBlock;
		blockNum <= endBlock;
		blockNum += settings.interval
	) {
		const vaultBalance = await getErc20BalanceAtBlock(
			settings.erc20Address,
			settings.vaultAddress,
			blockNum
		);
		const marketBalance = await getErc20BalanceAtBlock(
			settings.erc20Address,
			settings.marketAddress,
			blockNum
		);
		console.log(
			`${blockNum},${ethers.utils.formatUnits(
				vaultBalance,
				6
			)},${ethers.utils.formatUnits(marketBalance, 6)}`
		);
	}
	const vaultBalance = await getErc20BalanceAtBlock(
		settings.erc20Address,
		settings.vaultAddress,
		endBlock
	);
	const marketBalance = await getErc20BalanceAtBlock(
		settings.erc20Address,
		settings.marketAddress,
		endBlock
	);
	console.log(
		`${endBlock},${ethers.utils.formatUnits(
			vaultBalance,
			6
		)},${ethers.utils.formatUnits(marketBalance, 6)}`
	);
}

async function getErc20BalanceAtBlock(
	erc20Address: string,
	accountAddress: string,
	blockHeight: number
) {
	const factory = await ethers.getContractFactory("Token");
	const erc20Contract = factory.attach(erc20Address);
	try {
		const balance = await erc20Contract.balanceOf(accountAddress, {
			blockTag: blockHeight
		});
		return balance;
	} catch (error) {
		console.log(error);
		return 0;
	}
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
