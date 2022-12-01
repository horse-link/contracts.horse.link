import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Market, Token, Vault } from "../build/typechain";
import { getEventData } from "./utils";

chai.use(solidity);

describe("Vault", () => {
	let underlying: Token;
	let vault: Vault;
	let market: Market;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let underlyingDecimals: number;
	// 90 days in seconds
	const lockDuration = 7776000;

	beforeEach(async () => {
		// Import deployments tagged with these values
		const fixture = await deployments.fixture(["vault", "token", "market"]);

		[owner, alice, bob] = await ethers.getSigners();

		underlying = (await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		)) as Token;

		vault = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address,
			lockDuration
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

	it("Should return the correct symbol", async () => {
		expect(await underlying.symbol()).to.equal("USDT");
	});

	it("Should set properties on deploy", async () => {
		const vaultPerformance = await vault.getPerformance();
		expect(vaultPerformance).to.equal(0, "Should have no values");

		const _token = await vault.asset();
		expect(_token, "Should have token address as token").to.equal(
			underlying.address
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

		const underlyingDecimals = await underlying.decimals();
		const vaultDecimals = await vault.decimals();
		expect(vaultDecimals, "Decimals should be same as underlying").to.equal(
			underlyingDecimals
		);

		const _market = await vault.getMarket();
		expect(_market, "Should have market address").to.equal(market.address);
	});

	it("Should not be able set market twice", async () => {
		const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
		await expect(
			vault.connect(owner).setMarket(market.address, ONE_HUNDRED)
		).to.be.revertedWith("setMarket: Market already set");
	});

	describe("Deposit and shares", () => {
		beforeEach(async () => {
			const totalAssets = await vault.totalAssets();
			expect(totalAssets).to.equal(0);
		});

		it("Should get 0 market allowance", async () => {
			const allowance = await vault.getMarketAllowance();
			expect(allowance).to.equal(0);
		});

		it("Should allow msg.sender to receive shares when receiver address is address zero", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
			await underlying.connect(alice).approve(vault.address, ONE_HUNDRED);

			const originalTotalAssets = await vault.totalAssets();
			expect(originalTotalAssets).to.equal(0);
			await vault
				.connect(alice)
				.deposit(ONE_HUNDRED, ethers.constants.AddressZero);
			const totalAssets = await vault.totalAssets();

			expect(totalAssets).to.equal(ONE_HUNDRED);
			expect(await vault.balanceOf(alice.address)).to.equal(ONE_HUNDRED);
			const vaultPerformance = await vault.getPerformance();
			expect(vaultPerformance).to.equal(100);
		});

		it("Should preview deposit for shares for user", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
			const previewDeposit = await vault
				.connect(alice)
				.previewDeposit(ONE_HUNDRED);
			expect(previewDeposit).to.equal(ONE_HUNDRED);
		});

		it("Should deposit assets for two users and receive shares", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
			const FIFTY = ethers.utils.parseUnits("50", underlyingDecimals);

			await underlying.connect(alice).approve(vault.address, ONE_HUNDRED);
			await underlying.connect(bob).approve(vault.address, FIFTY);

			await vault.connect(alice).deposit(ONE_HUNDRED, alice.address);
			let shares = await vault.balanceOf(alice.address);
			expect(shares).to.equal(ONE_HUNDRED);

			let totalAssets = await vault.totalAssets();
			expect(totalAssets).to.equal(ONE_HUNDRED);

			await vault.connect(bob).deposit(FIFTY, bob.address);
			shares = await vault.balanceOf(bob.address);
			expect(shares).to.equal(FIFTY);

			totalAssets = await vault.totalAssets();
			expect(totalAssets).to.equal(
				ethers.utils.parseUnits("150", underlyingDecimals)
			);
		});
	});

	describe("Withdraw", () => {
		it("Should get maxWithdraw amount", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
			await underlying.connect(alice).approve(vault.address, ONE_HUNDRED);

			await vault.connect(alice).deposit(ONE_HUNDRED, alice.address);
			const maxWithdraw = await vault.maxWithdraw(alice.address);
			expect(maxWithdraw).to.equal(ONE_HUNDRED);
		});

		it("Should get previewWithdraw amount", async () => {
			const amount = ethers.utils.parseUnits("200", underlyingDecimals);
			await underlying.connect(bob).approve(vault.address, amount);

			await vault.connect(bob).deposit(amount, bob.address);
			const previewWithdraw = await vault.previewWithdraw(amount);
			expect(previewWithdraw).to.equal(amount);
		});

		it("Should not allow user to withdraw more than maxWithdraw", async () => {
			const amount = ethers.utils.parseUnits("1000", underlyingDecimals);
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
			).to.be.revertedWith("ERC4626: withdraw more than max");

			const receipt = await (
				await vault
					.connect(alice)
					.withdraw(
						ethers.utils.parseUnits("500", underlyingDecimals),
						alice.address,
						alice.address
					)
			).wait();
			expect(
				await vault.balanceOf(alice.address),
				"Balance of shares is wrong"
			).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));

			expect(
				await underlying.balanceOf(alice.address),
				"Balance of underlying assets is wrong"
			).to.equal(ethers.utils.parseUnits("1500", underlyingDecimals));

			const event = getEventData("Withdraw", vault, receipt);
			expect(event.sender, "Sender should be alice").to.equal(alice.address);
			expect(event.receiver, "Receiver should be alice").to.equal(
				alice.address
			);
			expect(
				event.assets,
				"Assets should be the amount of assets requested"
			).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));
		});

		it("Should not allow user to withdraw before the lock up period ends", async () => {
			const amount = ethers.utils.parseUnits("1000", underlyingDecimals);
			await underlying.connect(alice).approve(vault.address, amount);

			const timestamp = (await provider.getBlock(blockNumber)).timestamp;
			await vault.connect(alice).deposit(amount, alice.address);

			const lockedTime = await vault.lockedTime(alice.address);

			expect(lockedTime).to.equal(timestamp + lockDuration);
			await expect(
				vault
					.connect(alice)
					.withdraw(
						ethers.utils.parseUnits("100", underlyingDecimals),
						alice.address,
						alice.address
					)
			).to.be.revertedWith("withdraw: Locked time not passed");

			// const receipt = await (
			// 	await vault
			// 		.connect(alice)
			// 		.withdraw(
			// 			ethers.utils.parseUnits("500", underlyingDecimals),
			// 			alice.address,
			// 			alice.address
			// 		)
			// ).wait();
			// expect(
			// 	await vault.balanceOf(alice.address),
			// 	"Balance of shares is wrong"
			// ).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));

			// expect(
			// 	await underlying.balanceOf(alice.address),
			// 	"Balance of underlying assets is wrong"
			// ).to.equal(ethers.utils.parseUnits("1500", underlyingDecimals));

			// const event = getEventData("Withdraw", vault, receipt);
			// expect(event.sender, "Sender should be alice").to.equal(alice.address);
			// expect(event.receiver, "Receiver should be alice").to.equal(
			// 	alice.address
			// );
			// expect(
			// 	event.assets,
			// 	"Assets should be the amount of assets requested"
			// ).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));
		});
	});

	describe("Redeem", () => {
		it("Should get maxRedeem amount", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);
			await underlying.connect(alice).approve(vault.address, ONE_HUNDRED);

			await vault.connect(alice).deposit(ONE_HUNDRED, alice.address);
			const maxRedeem = await vault.maxRedeem(alice.address);
			expect(maxRedeem).to.equal(ONE_HUNDRED);
		});

		it("Should get previewRedeem amount with 0 amount", async () => {
			const previewRedeem = await vault.previewRedeem(0);
			expect(previewRedeem).to.equal(0);
		});

		it("Should get previewRedeem amount with some amount", async () => {
			const ONE_HUNDRED = ethers.utils.parseUnits("100", underlyingDecimals);

			const previewRedeem = await vault.previewRedeem(ONE_HUNDRED);
			expect(previewRedeem).to.equal(ONE_HUNDRED);
		});
	});
});
