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

	it("Should allow msg.sender to receive shares when receiver address is address zero", async () => {
		const amount = ethers.utils.parseUnits("100", underlyingDecimals);
		await underlying.connect(alice).approve(vault.address, amount);

		const originalTotalAssets = await vault.totalAssets();
		await vault.connect(alice).deposit(amount, ethers.constants.AddressZero);
		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(originalTotalAssets.add(amount));
		expect(await vault.balanceOf(alice.address)).to.equal(amount);
		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(100);
	});

	it("Should get user maxWithdraw amount", async () => {
		const amount = ethers.utils.parseUnits("100", underlyingDecimals);
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
			vault
				.connect(alice)
				.withdraw(
					ethers.utils.parseUnits("1001", underlyingDecimals),
					alice.address,
					alice.address
				)
		).to.be.revertedWith("withdraw: You do not have enough shares");

		const receipt = await (
			await vault
				.connect(alice)
				.withdraw(
					ethers.utils.parseUnits("500", underlyingDecimals),
					alice.address,
					alice.address
				)
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
