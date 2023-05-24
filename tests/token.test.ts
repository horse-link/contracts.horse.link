import chai, { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { TestAccounts, mockTokens } from "../deployData/settings";
import { Token } from "../build/typechain";

chai.use(solidity);

describe("Tokens", () => {
	it("Should have prefunded test addresses", async () => {
		const fixture = await deployments.fixture(["underlying"]);
		const { faucet } = await hre.getNamedAccounts();
		const [deployer] = await ethers.getSigners();
		for (const token of mockTokens) {
			const tokenContract = (await ethers.getContractAt(
				fixture[token.deploymentName].abi,
				fixture[token.deploymentName].address,
				deployer
			)) as Token;
			const faucetBalance = await tokenContract.balanceOf(faucet);
			expect(faucetBalance).to.equal(
				ethers.utils.parseUnits(token.mintAmount, token.decimals),
				`Faucet should have ${token.symbol} balance`
			);

			for (const account of TestAccounts) {
				const balance = await tokenContract.balanceOf(account.address);
				expect(
					balance,
					`Test account ${account.address} not pre-funded`
				).to.equal(
					ethers.utils.parseUnits(account.prefundAmount, token.decimals)
				);
			}
		}
	});
});
