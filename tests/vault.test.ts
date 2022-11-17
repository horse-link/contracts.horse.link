import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Market, Token, Vault } from "../build/typechain";

chai.use(solidity);

describe.only("Vault", () => {
	let underlying: Token;
	let vault: Vault;
	let market: Market;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let underlyingDecimals: number;

	beforeEach(async () => {
		// Import deployments tagged with these values
		const fixture = await deployments.fixture(["vault", "token"]);

		[owner, alice, bob] = await ethers.getSigners();

		underlying = (await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		)) as Token;

		vault = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		)) as Vault;

		market = (await ethers.getContractAt(
			fixture.UsdtMarket.abi,
			fixture.UsdtMarket.address
		)) as Market;

		underlyingDecimals = await underlying.decimals();

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("1000000", underlyingDecimals)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000", underlyingDecimals)
		);
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("2000", underlyingDecimals)
		);
	});

	it("Mock USDT has the correct symbol", async () => {
		expect(await underlying.symbol()).to.equal("USDT");
	});

	it("should set properties on deploy", async () => {
		const _token = await vault.asset();
		expect(_token).to.equal(
			underlying.address,
			"Should have token address as token"
		);

		const vaultName = await vault.name();
		const underlyingName = await underlying.name();
		expect(
			vaultName,
			"Name should be same as underlying with HL prefix"
		).to.equal(`HL ${underlyingName}`);

		const underlyingSymbol = await underlying.symbol();
		const vaultSymbol = await vault.symbol();
		expect(
			vaultSymbol,
			"Symbol should be same as underling with HL prefix"
		).to.equal(`HL${underlyingSymbol}`);

		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(0, "Should have no values");

		const _market = await vault.getMarket();
		expect(_market).to.equal(market.address, "Should have market address");
	});
});
