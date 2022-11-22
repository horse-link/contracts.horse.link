import { BigNumber, BigNumberish, BytesLike } from "ethers";
import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
	Market,
	MarketOracle,
	Market__factory,
	Registry,
	Token,
	Vault,
	Vault__factory
} from "../build/typechain";

chai.use(solidity);

describe("Registry", () => {
	let vault: Vault;
	let registry: Registry;
	let market: Market;
	let underlying: Token;
	let token: Token;
	let owner: SignerWithAddress;
	let nonTokenHolders: SignerWithAddress;

	beforeEach(async () => {
		const fixture = await deployments.fixture(["registry", "vault", "market"]);
		[owner, nonTokenHolders] = await ethers.getSigners();

		registry = await ethers.getContractAt(
			fixture.Registry.abi,
			fixture.Registry.address
		);

		vault = await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		);

		market = await ethers.getContractAt(
			fixture.UsdtMarket.abi,
			fixture.UsdtMarket.address
		);

		underlying = await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		);
	});

	it("Should have no markets or vaults", async () => {
		const market_count = await registry.marketCount();
		expect(market_count).to.equal(0, "Should have no markets");

		const vault_count = await registry.vaultCount();
		expect(vault_count).to.equal(0, "Should have no vaults");
	});

	it("Should only allow owner to set threshold", async () => {
		await expect(
			registry.connect(nonTokenHolders).setThreshold(100)
		).to.be.revertedWith("onlyOwner: Caller is not the contract owner");
	});

	it.skip("Should not allow under threshold holders to add vaults and market", async () => {
		const vault = await await new Vault__factory(owner).deploy(
			underlying.address
		);
		const market = await new Market__factory(owner).deploy(
			vault.address,
			1,
			ethers.constants.AddressZero
		);
		const thresholdAmount = ethers.BigNumber.from("1000");
		await registry.setThreshold(thresholdAmount);

		await expect(
			registry.connect(nonTokenHolders).addVault(vault.address)
		).to.be.revertedWith(
			"onlyTokenHolders: Caller does not hold enough tokens"
		);

		await expect(
			registry.connect(nonTokenHolders).addMarket(market.address)
		).to.be.revertedWith(
			"onlyTokenHolders: Caller does not hold enough tokens"
		);
	});

	it("Should be able to add markets and vaults", async () => {
		const market_count = await registry.marketCount();
		expect(market_count).to.equal(0, "Should have no markets");

		const vault_count = await registry.vaultCount();
		expect(vault_count).to.equal(0, "Should have no vaults");

		await registry.addMarket(market.address);
		const market_count2 = await registry.marketCount();
		expect(market_count2).to.equal(1, "Should have 1 market");

		await expect(registry.addMarket(market.address)).to.be.revertedWith(
			"addMarket: Market already added"
		);

		// await registry.addVault(vault.address);
		// const vault_count2 = await registry.vaultCount();
		// expect(vault_count2).to.equal(1, "Should have 1 vault");
	});
});
