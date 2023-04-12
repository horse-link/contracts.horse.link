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
import {
	constructBet,
	makeMarketId,
	makePropositionId,
	signBackMessage,
	signSetResultMessage
} from "./utils";
import { formatBytes16String } from "../scripts/utils";

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
		const args = [vault.address, MARGIN, TIMEOUT_DAYS, oracle.address];
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
			const propositionId = makePropositionId("ABC", 2);
			const marketId = makeMarketId(new Date(), "ABC", "2");

			const betSignature = await signBackMessage(
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
							formatBytes16String(nonce),
							formatBytes16String(propositionId),
							formatBytes16String(marketId),
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

			const winningPropositionId = makePropositionId("ABC", 1);
			const signature = await signSetResultMessage(
				marketId,
				winningPropositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(winningPropositionId),
				signature
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
			const propositionId = makePropositionId("ABC", 2);
			const marketId = makeMarketId(new Date(), "ABC", "2");

			const betSignature = await signBackMessage(
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
							formatBytes16String(nonce),
							formatBytes16String(propositionId),
							formatBytes16String(marketId),
							wager,
							odds,
							close,
							end,
							betSignature
						)
					)
			)
				.to.emit(market, "Borrowed")
				.withArgs(0, BigNumber.from(1000000));

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

			const winningPropositionId = makePropositionId("ABC", 1);
			const signature = await signSetResultMessage(
				marketId,
				winningPropositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(winningPropositionId),
				signature
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
	});
});
