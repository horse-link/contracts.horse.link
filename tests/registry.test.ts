import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
	Market,
	Market__factory,
	Registry,
	Token,
	Token__factory,
	Vault,
	Vault__factory
} from "../build/typechain";

chai.use(solidity);

describe("Registry", () => {
	let vault: Vault;
	let registry: Registry;
	let market: Market;
	let underlying: Token;
	let owner: SignerWithAddress;
	let nonTokenHolders: SignerWithAddress;
	let fixture: any;

	beforeEach(async () => {
		fixture = await deployments.fixture([
			"registry",
			"vault",
			"market",
			"underlying"
		]);
		[owner, nonTokenHolders] = await ethers.getSigners();

		registry = (await ethers.getContractAt(
			fixture.Registry.abi,
			fixture.Registry.address
		)) as Registry;
		vault = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		)) as Vault;
		market = (await ethers.getContractAt(
			fixture.UsdtMarket.abi,
			fixture.UsdtMarket.address
		)) as Market;
		underlying = (await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		)) as Token;
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

	/*it.skip("Should not allow under threshold holders to add vaults and market", async () => {
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
	});*/

	it("Should be able to add markets and vaults", async () => {
		const market_count = await registry.marketCount();
		expect(market_count, "Should have no markets").to.equal(0);

		const vault_count = await registry.vaultCount();
		expect(vault_count, "Should have no vaults").to.equal(0);

		await registry.addMarket(market.address);
		const market_count2 = await registry.marketCount();
		expect(market_count2, "Should have 1 market").to.equal(1);

		await expect(registry.addMarket(market.address)).to.be.revertedWith(
			"addMarket: Market already added"
		);

		await expect(
			registry.addVault(ethers.constants.AddressZero),
			"Should not be able to add null address"
		).to.be.reverted;

		await registry.addVault(vault.address);
		const vault_count2 = await registry.vaultCount();
		expect(vault_count2, "Should have 1 vault").to.equal(1);
	});

	it.only("Should be able to remove a market", async () => {
		const mockToken1 = await new Token__factory(owner).deploy(
			"Mock Token 1",
			"MTK1",
			18
		);
		const mockToken2 = await new Token__factory(owner).deploy(
			"Mock Token 2",
			"MTK2",
			18
		);
		const mockToken3 = await new Token__factory(owner).deploy(
			"Mock Token 3",
			"MTK3",
			18
		);

		const mockVault1 = await new Vault__factory(owner).deploy(
			mockToken1.address
		);
		const mockVault2 = await new Vault__factory(owner).deploy(
			mockToken2.address
		);
		const mockVault3 = await new Vault__factory(owner).deploy(
			mockToken3.address
		);

		const marketFactory = await ethers.getContractFactory("Market", {
			signer: owner,
			libraries: {
				SignatureLib: fixture.SignatureLib.address,
				OddsLib: fixture.OddsLib.address
			}
		});

		// const marketFactory = await new Market__factory(owner).deploy( {
		// 	signer: owner,
		// 	libraries: {
		// 		SignatureLib: fixture.SignatureLib.address,
		// 		OddsLib: fixture.OddsLib.address
		// 	}
		// });

		const args1 = [mockVault1.address, 1, 1, ethers.constants.AddressZero];
		const mockMarket1 = (await marketFactory.deploy(...args1)) as Market;

		const args2 = [mockVault2.address, 1, 1, ethers.constants.AddressZero];
		const mockMarket2 = (await marketFactory.deploy(...args2)) as Market;

		const args3 = [mockVault1.address, 1, 1, ethers.constants.AddressZero];
		const mockMarket3 = (await marketFactory.deploy(...args3)) as Market;

		await registry.addMarket(mockMarket1.address);
		await registry.addMarket(mockMarket2.address);
		await registry.addMarket(mockMarket3.address);

		const market_count = await registry.marketCount();
		expect(market_count, "Should have 3 markets").to.equal(3);

		// await registry.removeMarket(0, market.address);

		// market_count = await registry.marketCount();
		// expect(market_count, "Should have no markets").to.equal(0);
	});

	it.only("Should be able to remove a vault", async () => {
		const mockToken1 = await new Token__factory(owner).deploy(
			"Mock Token 1",
			"MTK1",
			18
		);
		const mockToken2 = await new Token__factory(owner).deploy(
			"Mock Token 2",
			"MTK2",
			18
		);
		const mockToken3 = await new Token__factory(owner).deploy(
			"Mock Token 3",
			"MTK3",
			18
		);

		const mockVault1 = await new Vault__factory(owner).deploy(
			mockToken1.address
		);
		const mockVault2 = await new Vault__factory(owner).deploy(
			mockToken2.address
		);
		const mockVault3 = await new Vault__factory(owner).deploy(
			mockToken3.address
		);

		await registry.addVault(mockVault1.address);
		await registry.addVault(mockVault2.address);
		await registry.addVault(mockVault3.address);

		let vault_count = await registry.vaultCount();
		expect(vault_count, "Should have 3 vaults").to.equal(3);

		await registry.removeVault(1, vault.address);

		vault_count = await registry.vaultCount();
		expect(vault_count, "Should have 2 vaults").to.equal(2);
	});
});
