import hre, { ethers, deployments } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BigNumber } from "ethers";
import chai, { expect } from "chai";
import {
	Market,
	MarketOracle,
	Token,
	Vault,
	Vault__factory
} from "../build/typechain";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { constructBet, signSetResultMessage } from "./utils";
import { formatting, markets, signature } from "horselink-sdk";

chai.use(solidity);

describe("Market", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;
	const TIMEOUT_DAYS = 5;

	beforeEach(async () => {
		[owner, alice, bob] = await ethers.getSigners();
		oracleSigner = owner;
		const fixture = await deployments.fixture([
			"underlying",
			"registry",
			"vault",
			"market",
			"oracle"
		]);

		underlying = (await ethers.getContractAt(
			fixture.MockUsdt.abi,
			fixture.MockUsdt.address
		)) as Token;
		vault = (await ethers.getContractAt(
			fixture.MockUsdtVault.abi,
			fixture.MockUsdtVault.address
		)) as Vault;
		market = (await ethers.getContractAt(
			fixture.MockUsdtMarket.abi,
			fixture.MockUsdtMarket.address
		)) as Market;
		oracle = (await ethers.getContractAt(
			fixture.MarketOracle.abi,
			fixture.MarketOracle.address
		)) as MarketOracle;

		tokenDecimals = await underlying.decimals();

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("1000000", USDT_DECIMALS)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000000", USDT_DECIMALS)
		);
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const OddsLib = await ethers.getContractFactory("MockOddsLib");
		const oddsLib = await OddsLib.deploy();
		await oddsLib.deployed();

		const marketFactory = await ethers.getContractFactory("Market", {
			signer: owner,
			libraries: {
				SignatureLib: signatureLib.address,
				OddsLib: oddsLib.address
			}
		});

		// https://www.npmjs.com/package/hardhat-deploy?activeTab=readme#handling-contract-using-libraries
		// https://stackoverflow.com/questions/71389974/how-can-i-link-library-and-contract-in-one-file
		const args = [
			vault.address,
			MARGIN,
			TIMEOUT_DAYS,
			oracle.address,
			"https://example.org/"
		];
		market = (await marketFactory.deploy(...args)) as Market;

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000); // 7% interest rate
		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.constants.MaxUint256);
		await vault
			.connect(alice)
			.deposit(ethers.utils.parseUnits("1000", tokenDecimals), alice.address);
	});

	describe("Fixed odds betting", () => {
		beforeEach(async () => {
			// Vault should have 1000 USDT
			const vaultAssets = await vault.totalAssets();
			expect(vaultAssets).to.equal(
				ethers.utils.parseUnits("1000", tokenDecimals)
			);
		});

		it("Should settle bobs losing bet by index", async () => {
			const balance = await underlying.balanceOf(vault.address);
			expect(balance).to.equal(ethers.utils.parseUnits("1000", tokenDecimals));

			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 2 for a Win
			const nonce = "2";
			const marketId = "20240101ABC2W";
			const propositionId = markets.makePropositionId(marketId, 2);

			const betSignature = await signature.signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			const count = await market.getCount();
			expect(count, "There should be no bets").to.equal(0);

			expect(
				await market
					.connect(bob)
					.back(
						constructBet(
							formatting.formatBytes16String(nonce),
							formatting.formatBytes16String(propositionId),
							formatting.formatBytes16String(marketId),
							wager,
							odds,
							close,
							end,
							betSignature
						)
					)
			).to.emit(market, "Placed");

			// Check bob and vault balances
			let bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("900", USDT_DECIMALS)
			);

			// Vault should have lent 400 USDT and have 600 USDT left
			let vaultBalance = await underlying.balanceOf(vault.address);
			expect(vaultBalance).to.equal(
				ethers.utils.parseUnits("600", USDT_DECIMALS)
			);

			const vaultAssets = await vault.totalAssets();
			expect(vaultAssets).to.equal(
				ethers.utils.parseUnits("600", tokenDecimals)
			);

			const winningPropositionId = markets.makePropositionId("ABC", 1);
			const _signature = await signSetResultMessage(
				marketId,
				winningPropositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatting.formatBytes16String(marketId),
				formatting.formatBytes16String(winningPropositionId),
				_signature
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			// Bob should have lost his bet and still have 900 USDT
			// The vault should have received 1028 USDT back from the 7% of interest on the 400 USDT it lent
			// The market owner should earned 72 USDT
			const index = 0;
			expect(await market.settle(index))
				.to.emit(market, "Repaid")
				.withArgs(vault.address, 428000000);

			vaultBalance = await underlying.balanceOf(vault.address);
			expect(vaultBalance).to.equal(
				ethers.utils.parseUnits("1028", USDT_DECIMALS)
			);

			bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("900", USDT_DECIMALS)
			);

			const marketOwnerBalance = await underlying.balanceOf(owner.address);
			expect(marketOwnerBalance).to.equal(
				ethers.utils.parseUnits("998999072", USDT_DECIMALS)
			);
		});

		it("Should break when odds are less than the rate of 7%", async () => {
			const balance = await underlying.balanceOf(vault.address);
			expect(balance).to.equal(ethers.utils.parseUnits("1000", tokenDecimals));

			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = BigNumber.from(1010000); // Odds equivalent to $1.01
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 2 for a Win
			const nonce = "2";
			const marketId = "20240101ABC2W";
			const propositionId = markets.makePropositionId(marketId, 2);

			const betSignature = await signature.signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			const count = await market.getCount();
			expect(count, "There should be no bets").to.equal(0);

			expect(
				await market
					.connect(bob)
					.back(
						constructBet(
							formatting.formatBytes16String(nonce),
							formatting.formatBytes16String(propositionId),
							formatting.formatBytes16String(marketId),
							wager,
							odds,
							close,
							end,
							betSignature
						)
					)
			)
				.to.emit(market, "Borrowed")
				.withArgs(vault.address, 0, BigNumber.from(1000000));

			// Check bob and vault balances
			let bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("900", USDT_DECIMALS)
			);

			// Vault should have lent 1 USDT
			const vaultBalance = await underlying.balanceOf(vault.address);
			expect(vaultBalance).to.equal(
				ethers.utils.parseUnits("999", USDT_DECIMALS)
			);

			const vaultAssets = await vault.totalAssets();
			expect(vaultAssets).to.equal(
				ethers.utils.parseUnits("999", tokenDecimals)
			);

			const winningPropositionId = markets.makePropositionId("ABC", 1);
			const _signature = await signSetResultMessage(
				marketId,
				winningPropositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatting.formatBytes16String(marketId),
				formatting.formatBytes16String(winningPropositionId),
				_signature
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			// Bob should have lost his bet and still have 900 USDT
			const index = 0;
			expect(await market.settle(index))
				.to.emit(market, "Repaid")
				.withArgs(vault.address, 1070000)
				.to.emit(market, "Settled");

			bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("900", USDT_DECIMALS)
			);
		});

		it("Should settle a losing bet with a large loan and not send the market owner any reward", async () => {
			// Add some extra collateral to the market so that we can test the market owner not receiving any reward
			// Otherwise the transaction will simply fail with "ERC20: transfer amount exceeds balance"
			await underlying
				.connect(owner)
				.transfer(
					market.address,
					ethers.utils.parseUnits("1000", tokenDecimals)
				);

			const balance = await underlying.balanceOf(vault.address);
			expect(balance).to.equal(ethers.utils.parseUnits("1000", tokenDecimals));

			const wager = ethers.utils.parseUnits("1", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("20", ODDS_DECIMALS);
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 2 for a Win
			const nonce = "2";
			const propositionId = markets.makePropositionId("ABC", 2);
			const marketId = "20240101ABC2W";

			const betSignature = await signature.signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			const count = await market.getCount();
			expect(count, "There should be no bets").to.equal(0);

			expect(
				await market
					.connect(bob)
					.back(
						constructBet(
							formatting.formatBytes16String(nonce),
							formatting.formatBytes16String(propositionId),
							formatting.formatBytes16String(marketId),
							wager,
							odds,
							close,
							end,
							betSignature
						)
					)
			).to.emit(market, "Placed");

			// Check bob and vault balances
			let bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("999", USDT_DECIMALS)
			);

			// Vault should have lent 19 USDT and have 981 USDT left
			let vaultBalance = await underlying.balanceOf(vault.address);
			expect(vaultBalance).to.equal(
				ethers.utils.parseUnits("981", USDT_DECIMALS)
			);

			const vaultAssets = await vault.totalAssets();
			expect(vaultAssets).to.equal(
				ethers.utils.parseUnits("981", tokenDecimals)
			);

			const winningPropositionId = markets.makePropositionId("ABC", 1);
			const _signature = await signSetResultMessage(
				marketId,
				winningPropositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatting.formatBytes16String(marketId),
				formatting.formatBytes16String(winningPropositionId),
				_signature
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			// Bob should have lost his bet and still have 999 USDT
			// The vault should have received 20.33 USDT back from the 7% of interest on the 19 USDT it lent
			// The market owner should earned 0 USDT
			const originalMarketOwnerBalance = await underlying.balanceOf(
				owner.address
			);
			const index = 0;
			expect(await market.settle(index))
				.to.emit(market, "Repaid")
				.withArgs(vault.address, 20330000);
			// We should be ahead 1.33 USD
			vaultBalance = await underlying.balanceOf(vault.address);
			expect(vaultBalance).to.equal(
				ethers.utils.parseUnits("1001.33", USDT_DECIMALS)
			);

			bobBalance = await underlying.balanceOf(bob.address);
			expect(bobBalance).to.equal(
				ethers.utils.parseUnits("999", USDT_DECIMALS)
			);

			const marketOwnerBalance = await underlying.balanceOf(owner.address);
			expect(marketOwnerBalance).to.equal(originalMarketOwnerBalance);
		});
	});
});
