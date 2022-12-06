import chai, { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Market, Token, Vault, VaultTimeLock } from "../build/typechain";
import { getEventData } from "./utils";

chai.use(solidity);

describe("Vault", () => {
	let underlying: Token;
	let vault: Vault;
	let vaultTimeLock: VaultTimeLock;
	let market: Market;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let underlyingDecimals: number;

	beforeEach(async () => {
		// Import deployments tagged with these values
		const fixture = await deployments.fixture([
			"vault",
			"vaultTimeLock",
			"token",
			"market"
		]);

		[owner, alice, bob] = await ethers.getSigners();

		underlying = (await ethers.getContractAt(
			fixture.Usdt.abi,
			fixture.Usdt.address
		)) as Token;

		vault = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		)) as Vault;

		vaultTimeLock = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		)) as VaultTimeLock;

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

		const lockDuration = await vault.lockDuration();
		expect(lockDuration, "Should have market address").to.equal(
			process.env.VAULT_LOCK_TIME
		);
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

			const lockedTime = (
				await vaultTimeLock.lockedTime(alice.address)
			).toNumber();

			// Move past the lock up period
			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [lockedTime + 1]
			});

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
			await underlying.connect(alice).approve(vaultTimeLock.address, amount);

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);
			await vaultTimeLock.connect(alice).deposit(amount, alice.address);

			const lockedTime = (
				await vaultTimeLock.lockedTime(alice.address)
			).toNumber();

			expect(lockedTime).to.equal(
				latestBlock.timestamp + Number(process.env.VAULT_LOCK_TIME) + 1
			);
			await expect(
				vaultTimeLock
					.connect(alice)
					.withdraw(
						ethers.utils.parseUnits("100", underlyingDecimals),
						alice.address,
						alice.address
					)
			).to.be.revertedWith("_withdraw: Locked time not passed");

			// Should not be able to transfer or transferFrom before the lock up period ends
			await expect(
				vaultTimeLock
					.connect(alice)
					.transfer(
						alice.address,
						ethers.utils.parseUnits("100", underlyingDecimals)
					)
			).to.be.revertedWith("_transfer: Locked time not passed");

			await vaultTimeLock
				.connect(alice)
				.approve(
					owner.address,
					ethers.utils.parseUnits("100", underlyingDecimals)
				);

			await expect(
				vaultTimeLock
					.connect(owner)
					.transferFrom(
						alice.address,
						owner.address,
						ethers.utils.parseUnits("100", underlyingDecimals)
					)
			).to.be.revertedWith("_transfer: Locked time not passed");

			// Move past the lock up period
			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [lockedTime + 1]
			});

			const receipt = await (
				await vaultTimeLock
					.connect(alice)
					.withdraw(
						ethers.utils.parseUnits("500", underlyingDecimals),
						alice.address,
						alice.address
					)
			).wait();
			expect(
				await vaultTimeLock.balanceOf(alice.address),
				"Balance of shares is wrong"
			).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));

			expect(
				await underlying.balanceOf(alice.address),
				"Balance of underlying assets is wrong"
			).to.equal(ethers.utils.parseUnits("1500", underlyingDecimals));

			const event = getEventData("Withdraw", vaultTimeLock, receipt);
			expect(event.sender, "Sender should be alice").to.equal(alice.address);
			expect(event.receiver, "Receiver should be alice").to.equal(
				alice.address
			);
			expect(
				event.assets,
				"Assets should be the amount of assets requested"
			).to.equal(ethers.utils.parseUnits("500", underlyingDecimals));

			// Should now be able to transfer or transferFrom since the lock up period ends
			await expect(
				vaultTimeLock
					.connect(alice)
					.transfer(
						owner.address,
						ethers.utils.parseUnits("1", underlyingDecimals)
					)
			).to.not.be.revertedWith("_transfer: Locked time not passed");

			await vaultTimeLock
				.connect(alice)
				.approve(
					owner.address,
					ethers.utils.parseUnits("1", underlyingDecimals)
				);

			await expect(
				vaultTimeLock
					.connect(owner)
					.transferFrom(
						alice.address,
						owner.address,
						ethers.utils.parseUnits("1", underlyingDecimals)
					)
			).to.not.be.revertedWith("_transfer: Locked time not passed");

			expect(
				await vaultTimeLock.balanceOf(owner.address),
				"Balance of shares is wrong"
			).to.equal(ethers.utils.parseUnits("2", underlyingDecimals));
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

	describe("Redeeming and Withdrawing with an active Market", () => {
		//Investor A: Deposits 100 underlying
		//Investor B: Deposits 900 underlying
		//Investor A has 100 shares, 10% of the pool
		//Investor B has 900 shares, 90% of the pool
		//The Market transfers out 100 underlying to cover a bet
		//The Market totalExposure is now 100
		//The Vault totalLockedAssets is now 100
		//The Vault totalAssets should remain the same
		//The Vault totalSupply should remain the same
		//InvestorA's maxRedeem should be reduced by their share of the withdrawn amount
		//InvestorB's maxRedeem should be reduced by their share of the withdrawn amount
		//InvestorA's maxWithdraw should be reduced by their share of the withdrawn amount
		//InvestorB's maxWithdraw should be reduced by their share of the withdrawn amount
		//InvestorA cannot redeem more than their maxRedeem
		//InvestorA cannot withdraw more than their maxWithdraw
		//The market loses the bet and the cover amount is lost
		//The Vault totalLockedAssets is now 0
		//The Vault totalAssets should have gone down by the cover amount
		//InvestorA's maxRedeem should be equal to their share balance
	});
});
