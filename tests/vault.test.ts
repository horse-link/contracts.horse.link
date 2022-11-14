import { BigNumber, BigNumberish, BytesLike } from "ethers";
import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Market, MarketOracle, Token, Vault } from "../build/typechain";
import { getEventData } from "./utils";

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
		const fixture = await deployments.fixture([
			"token",
			"oracle",
			"vault",
			"market"
		]);

		[owner, alice, bob] = await ethers.getSigners();

		underlying = await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		);
		vault = await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		);
		market = await ethers.getContractAt(
			fixture.UsdtMarket.abi,
			fixture.UsdtMarket.address
		);
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

	it("Mock USDT has correreturn the correct symbol", async () => {
		expect(await underlying.symbol()).to.equal("USDT");
	});

	it("should set properties on deploy", async () => {
		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(0, "Should have no values");

		const _token = await vault.asset();
		expect(_token).to.equal(
			underlying.address,
			"Should have token address as token"
		);

		const _market = await vault.getMarket();
		expect(_market).to.equal(market.address, "Should have market address");

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
	});

	it("Should only allow owner to set market", async () => {
		await expect(
			vault
				.connect(alice)
				.setMarket(market.address, ethers.constants.MaxUint256)
		).to.be.revertedWith("Ownable: caller is not the owner");
	});

	it("Should not set market if market already set", async () => {
		await expect(
			vault.setMarket(
				market.address, //"0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", // random address
				ethers.constants.MaxUint256
			)
		).to.be.revertedWith("setMarket: Market already set");
	});

	it("Should get total assets 0 in vault after contract deployment", async () => {
		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(0, "Should have no assets");
	});

	it("Should not allow deposit asset with zero value", async () => {
		await expect(
			vault
				.connect(alice)
				.deposit(ethers.utils.parseUnits("0", 6), alice.address)
		).to.be.revertedWith("deposit: Value must be greater than 0");
	});

	it("Should allow user to deposit supported assets and get performance", async () => {
		const amount = ethers.utils.parseUnits("100", 6);
		await underlying.connect(alice).approve(vault.address, amount);

		const receipt = await (
			await vault.connect(alice).deposit(amount, alice.address)
		).wait();
		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(amount);
		expect(await vault.balanceOf(alice.address)).to.equal(amount);
		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(100);
		const event = getEventData("Deposit", vault, receipt);
		expect(event.who).to.equal(alice.address);
		expect(event.value).to.equal(amount);
	});

	it("Should allow msg.sender to receive shares when receiver address is address zero", async () => {
		const amount = ethers.utils.parseUnits("100", 6);
		await underlying.connect(alice).approve(vault.address, amount);

		const originalTotalAssets = await vault.totalAssets();
		await vault
			.connect(alice)
			.deposit(amount, ethers.constants.AddressZero);
		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(originalTotalAssets.add(amount));
		expect(await vault.balanceOf(alice.address)).to.equal(amount);
		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(100);
	});

	it("Should get user maxWithdraw amount", async () => {
		const amount = ethers.utils.parseUnits("100", 6);
		await underlying.connect(alice).approve(vault.address, amount);

		await vault.connect(alice).deposit(amount, alice.address);
		const maxWithdraw = await vault.maxWithdraw(alice.address);
		expect(maxWithdraw).to.equal(amount);
	});

	it("Should get previewWithdraw amount", async () => {
		const amount = ethers.utils.parseUnits("200", 6);
		await underlying.connect(bob).approve(vault.address, amount);

		await vault.connect(bob).deposit(amount, bob.address);
		const previewWithdraw = await vault.previewWithdraw(amount);
		expect(previewWithdraw).to.equal(amount);
	});

	it("Should not allow user to withdraw more than maxWithdraw", async () => {
		const amount = ethers.utils.parseUnits("1000", 6);
		await underlying.connect(alice).approve(vault.address, amount);

		await vault.connect(alice).deposit(amount, alice.address);

		await expect(
			vault.connect(alice).withdraw(ethers.utils.parseEther("1001"))
		).to.be.revertedWith("withdraw: You do not have enough shares");

		const receipt = await (
			await vault
				.connect(alice)
				.withdraw(ethers.utils.parseUnits("500", 6))
		).wait();
		expect(await vault.balanceOf(alice.address)).to.equal(
			ethers.utils.parseUnits("500", 6)
		);

		expect(await underlying.balanceOf(alice.address)).to.equal(
			ethers.utils.parseUnits("1500", 6)
		);

		const event = getEventData("Withdraw", vault, receipt);
		expect(event.who).to.equal(alice.address);
		expect(event.value).to.equal(amount);
	});
});
