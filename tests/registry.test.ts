import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
	HorseLink,
	Market,
	Registry,
	Token,
	// Token,
	Token__factory,
	Vault,
	Vault__factory
} from "../build/typechain";

chai.use(solidity);

describe("Registry", () => {
	let vault: Vault;
	let registry: Registry;
	let market: Market;
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

		await registry.setThreshold(ethers.utils.parseEther("1"));

		vault = (await ethers.getContractAt(
			fixture.MockUsdtVault.abi,
			fixture.MockUsdtVault.address
		)) as Vault;

		console.log("Vault address: ", vault.address);

		market = (await ethers.getContractAt(
			fixture.MockUsdtMarket.abi,
			fixture.MockUsdtMarket.address
		)) as Market;

		const hl = (await ethers.getContractAt(
			fixture.MockHorseLink.abi,
			fixture.MockHorseLink.address
		)) as Token;

		await hl.mint(owner.address, ethers.utils.parseEther("1000000"));
		// expect(await hl.balanceOf(owner.address)).to.equal(
		// 	ethers.utils.parseEther("1001000")
		// );
	});

	it("Owner should have enough tokens", async () => {
		const threshold = await registry.getThreshold();
		expect(threshold).to.equal(ethers.utils.parseEther("1"));
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

		expect(await registry.addMarket(market.address)).to.emit(
			registry,
			"MarketAdded"
		);

		const market_count2 = await registry.marketCount();
		expect(market_count2, "Should have 1 market").to.equal(1);

		await expect(registry.addMarket(market.address)).to.be.revertedWith(
			"addMarket: Market already added"
		);

		// this is an assert not revert
		// await expect(
		// 	registry.addVault(ethers.constants.AddressZero)
		// ).to.be.revertedWith("Should not be able to add null address");

		// await expect(registry.addVault(vault.address)).to.emit(
		// 	registry,
		// 	"VaultAdded"
		// );

		// const vault_count2 = await registry.vaultCount();
		// expect(vault_count2, "Should have 1 vault").to.equal(1);
	});

	it.skip("Should be able to remove a market", async () => {
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

		const args1 = [mockVault1.address, 1, 1, ethers.constants.AddressZero, ""];
		const mockMarket1 = (await marketFactory.deploy(...args1)) as Market;

		const args2 = [mockVault2.address, 1, 1, ethers.constants.AddressZero, ""];
		const mockMarket2 = (await marketFactory.deploy(...args2)) as Market;

		const args3 = [mockVault3.address, 1, 1, ethers.constants.AddressZero, ""];
		const mockMarket3 = (await marketFactory.deploy(...args3)) as Market;

		await registry.addMarket(mockMarket1.address);
		await registry.addMarket(mockMarket2.address);
		await registry.addMarket(mockMarket3.address);

		let market_count = await registry.marketCount();
		expect(market_count, "Should have 3 markets").to.equal(3);

		await registry.removeMarket(1);

		market_count = await registry.marketCount();
		expect(market_count, "Should have 2 markets").to.equal(2);

		const market2 = await registry.markets(1);
		expect(market2, "Should have market 3").to.equal(mockMarket3.address);
	});

	it("Should be able to remove a vault", async () => {
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

		const market2 = await registry.vaults(1);
		expect(market2, "Should have vault 3").to.equal(mockVault3.address);
	});
});
