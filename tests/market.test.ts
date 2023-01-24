import hre, { ethers, deployments } from "hardhat";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
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
	formatBytes16String,
	makeMarketId,
	makePropositionId,
	signBackMessage,
	signSetResultMessage
} from "./utils";
import { formatUnits } from "ethers/lib/utils";

// MarketId 11 chars
// AAAAAABBBCC
// A = date as days since epoch
// B = location code
// C = race number
const MARKET_ID = "019123BNE01";

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
	let carol: SignerWithAddress;
	let whale: SignerWithAddress;
	let marketSigner: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;
	const TIMEOUT_DAYS = 5;

	beforeEach(async () => {
		[owner, alice, bob, carol, whale] = await ethers.getSigners();
		marketSigner = alice;
		oracleSigner = owner;
		const fixture = await deployments.fixture([
			"token",
			"registry",
			"vault",
			"market",
			"oracle"
		]);

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
		await underlying.transfer(
			carol.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);
		await underlying.transfer(
			whale.address,
			ethers.utils.parseUnits("10000000", USDT_DECIMALS)
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const OddsLib = await ethers.getContractFactory("OddsLib");
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

		await vault.setMarket(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(carol)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(whale)
			.approve(vault.address, ethers.constants.MaxUint256);

		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(carol)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(whale)
			.approve(market.address, ethers.constants.MaxUint256);

		// Should get 0 odds if vault has ZERO assets
		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const propositionId = formatBytes16String("1");
		const marketId = formatBytes16String("1");
		expect(await market.getOdds(wager, odds, propositionId, marketId)).to.equal(
			1
		);
		// Should get potential payout = wager if vault has no assets
		expect(
			await market.getPotentialPayout(propositionId, marketId, wager, odds)
		).to.equal(wager);

		await vault
			.connect(alice)
			.deposit(ethers.utils.parseUnits("1000", tokenDecimals), alice.address);
	});

	it("Should have properties set on deploy", async () => {
		const margin = await market.getMargin();
		expect(margin, "margin should be set").to.equal(MARGIN);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay, "Should have $0 in play").to.equal(0);

		const totalExposure = await market.getTotalExposure();
		expect(totalExposure, "Should have $0 exposure").to.equal(0);

		const vaultAddress = await market.getVaultAddress();
		expect(vaultAddress, "Should have vault address").to.equal(vault.address);

		expect(await market.getOracleAddress()).to.equal(oracle.address);
		expect(await vault.getMarketAllowance()).to.equal(1000000000);
	});

	it("Should get correct odds on a 5:1 punt", async () => {
		const balance = await underlying.balanceOf(bob.address);
		expect(balance, "Should have $1,000 USDT").to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);

		// check vault balance
		const vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance, "Should have $1,000 USDT in vault").to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);

		const totalAssets = await vault.totalAssets();
		expect(totalAssets, "Should have $1,000 USDT total assets").to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.utils.parseUnits("50", tokenDecimals));

		const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

		// Runner 1 for a Win
		const propositionId = formatBytes16String("1");
		const marketId = formatBytes16String("1");

		// there still needs to be slippage in the odds
		const trueOdds = await market.getOdds(
			ethers.utils.parseUnits("50", USDT_DECIMALS),
			targetOdds,
			propositionId,
			marketId
		);

		expect(
			trueOdds,
			"Should have true odds of 3.809524 on $50 in a $1,000 pool"
		).to.be.closeTo(BigNumber.from(3809524), 1);

		const potentialPayout = await market.getPotentialPayout(
			propositionId,
			marketId,
			ethers.utils.parseUnits("50", USDT_DECIMALS),
			targetOdds
		);

		expect(potentialPayout, "Payout should be 190476190").to.be.closeTo(
			BigNumber.from(190476190),
			10
		);
	});

	it("Should not allow back with invalid signature", async () => {
		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000000;

		// Runner 1 for a Win
		const nonce = "1";
		const propositionId = makePropositionId("ABC", 1);
		const marketId = makeMarketId(new Date(), "ABC", "1");
		const betSignature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			alice // alice should not sign
		);

		await expect(
			market
				.connect(bob)
				.back(
					formatBytes16String(nonce),
					formatBytes16String(propositionId),
					formatBytes16String(marketId),
					wager,
					odds,
					close,
					end,
					betSignature
				)
		).to.be.revertedWith("back: Invalid signature");
	});

	it("Should allow Bob a $100 punt at 5:1", async () => {
		let balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);

		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000;

		// check vault balance
		let vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT in vault"
		);

		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT total assets"
		);

		await underlying
			.connect(bob)
			.approve(market.address, ethers.utils.parseUnits("100", tokenDecimals));

		const marketId = makeMarketId(new Date(), "ABC", "1");
		const propositionId = makePropositionId(marketId, 1);
		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(bob)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(propositionId),
				formatBytes16String(marketId),
				wager,
				odds,
				close,
				end,
				signature
			);

		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			ethers.utils.parseUnits("100", USDT_DECIMALS)
		);

		balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("900", USDT_DECIMALS),
			"Should have $900 USDT after a $100 bet"
		);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(ethers.utils.parseUnits("100", USDT_DECIMALS));

		vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			BigNumber.from(827272700),
			"Vault should have $827.27 USDT"
		);

		// Should get expiry after back bet
		const expiry = await market.getExpiry(0);
		expect(expiry).to.equal(
			end + TIMEOUT_DAYS * 86400,
			"Should have expiry set"
		);

		const tokenOwner = await market.ownerOf(0);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Should allow Carol a $200 punt at 2:1", async () => {
		let balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("200", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000;

		// check vault balance
		const vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT in vault"
		);

		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT total assets"
		);

		await underlying
			.connect(carol)
			.approve(market.address, ethers.utils.parseUnits("200", tokenDecimals));
		// Runner 2 for a Win
		const marketId = makeMarketId(new Date(), "ABC", "1");
		const propositionId = makePropositionId(marketId, 2);
		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(carol)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(propositionId),
				formatBytes16String(marketId),
				wager,
				odds,
				close,
				end,
				signature
			);

		balance = await underlying.balanceOf(carol.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("800", USDT_DECIMALS),
			"Should have $800 USDT after a $200 bet"
		);
	});

	it.skip("Greedy market", async () => {
		// Alice bets on $10 horse 1, with a payout of $100
		// Market borrows payout - wager amount
		// Betty bets $10 on horse 2, with a payout of $90
		// Market does not borrow any amount
		// Carol bets another $10 on horse 2, bringing the total potential payout for this horse to $180
		// Market borrows $80 to cover the new potential payout
		const marketId = makeMarketId(new Date(), "ABC", "1");
		const horses = [
			ethers.utils.parseUnits("10", ODDS_DECIMALS),
			ethers.utils.parseUnits("9", ODDS_DECIMALS)
		];
		const proposition1 = makePropositionId(marketId, 1);
		const proposition2 = makePropositionId(marketId, 2);
		const close = 0;
		const end = 1000000000000;

		const totalAssets1 = await vault.totalAssets();
		expect(totalAssets1).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT total assets"
		);
		const nonce = "1";

		const sigBack1 = await signBackMessage(
			nonce,
			marketId,
			proposition1,
			horses[0],
			close,
			end,
			owner
		);

		const sigBack2 = await signBackMessage(
			nonce,
			marketId,
			proposition2,
			horses[1],
			close,
			end,
			owner
		);

		// 1. Alice bets on $10 horse 1, with a payout of $100
		await underlying
			.connect(carol)
			.approve(market.address, ethers.utils.parseUnits("10", tokenDecimals));

		await market
			.connect(carol)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(proposition1),
				formatBytes16String(marketId),
				ethers.utils.parseUnits("10", USDT_DECIMALS),
				horses[0],
				close,
				end,
				sigBack1
			);

		// Market borrows payout - wager amount
		const totalAssets2 = await vault.totalAssets();
		expect(totalAssets2, "Should have had to borrow initial cover").to.be.lt(
			totalAssets1
		);

		// 2. Betty bets $10 on horse 2, with a payout of $90
		await underlying
			.connect(carol)
			.approve(market.address, ethers.utils.parseUnits("10", tokenDecimals));

		await market
			.connect(carol)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(proposition2),
				formatBytes16String(marketId),
				ethers.utils.parseUnits("10", USDT_DECIMALS),
				horses[1],
				close,
				end,
				sigBack2
			);

		// Market does not borrow any amount
		const totalAssets3 = await vault.totalAssets();
		expect(totalAssets3, "Market should not need to borrow").to.equal(
			totalAssets2
		);

		// 3. Carol bets another $10 on horse 2, bringing the total potential payout for this horse to $180 (assuming no slippage)
		await underlying
			.connect(carol)
			.approve(market.address, ethers.utils.parseUnits("10", tokenDecimals));

		await market
			.connect(carol)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(proposition2),
				formatBytes16String(marketId),
				ethers.utils.parseUnits("10", USDT_DECIMALS),
				horses[1],
				close,
				end,
				sigBack2
			);

		// Market borrows payout - wager amount
		const totalAssets4 = await vault.totalAssets();
		expect(totalAssets4, "Should have had to borrow extra cover").to.be.lt(
			totalAssets3
		);
	});

	it("Should not allow a betting attack", async () => {
		// Whale has some USDT but he wants more
		const whaleOriginalBalance = await underlying.balanceOf(whale.address);

		// Alice is an honest investor and deposits $20000 USDT
		await vault
			.connect(alice)
			.deposit(ethers.utils.parseUnits("20000", USDT_DECIMALS), alice.address);

		// Now Whale attacks
		const wager = ethers.utils.parseUnits("9000", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
		const close = 0;

		// Whale makes a bet but he doesn't care if he loses
		const latestBlockNumber = await ethers.provider.getBlockNumber();
		const latestBlock = await ethers.provider.getBlock(latestBlockNumber);
		const end = latestBlock.timestamp + 10000;
		const propositionId = makePropositionId("ABC", 1);
		const marketId = makeMarketId(new Date(), "ABC", "1");

		const nonce = "1";

		const betSignature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await underlying.connect(whale).approve(market.address, wager);
		await market
			.connect(whale)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(propositionId),
				formatBytes16String(marketId),
				wager,
				odds,
				close,
				end,
				betSignature
			);

		// Whale now buys shares
		await vault
			.connect(whale)
			.deposit(ethers.utils.parseUnits("20000", USDT_DECIMALS), whale.address);

		// Whale's bet loses
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [end + 7200]
		});

		const signature = await signSetResultMessage(
			marketId,
			propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(marketId),
			formatBytes16String(propositionId),
			signature
		);
		await market.connect(alice).settle(0);

		// Whale sells all their shares, smiling
		await vault
			.connect(whale)
			.redeem(
				ethers.utils.parseUnits("1000", USDT_DECIMALS),
				whale.address,
				whale.address
			);

		// Did Whale profit from the attack?
		const whaleBalance = await underlying.balanceOf(whale.address);
		expect(
			whaleBalance,
			`Whale just made an easy ${whaleOriginalBalance
				.sub(whaleBalance)
				.toNumber()}`
		).to.be.lt(whaleOriginalBalance);
	});

	describe("Settle", () => {
		it.skip("Should transfer to vault if result not been set", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const close = 0;
			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 1 for a Win
			const marketId = makeMarketId(new Date(), "ABC", "1");
			const propositionId = makePropositionId(marketId, 1);
			const nonce = "1";

			const betSignature = await signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			expect(
				await market
					.connect(bob)
					.back(
						formatBytes16String(nonce),
						formatBytes16String(propositionId),
						formatBytes16String(marketId),
						wager,
						odds,
						close,
						end,
						betSignature
					)
			).to.emit(market, "Placed");

			const vaultBalanceBefore = await underlying.balanceOf(vault.address);
			const index = 0;
			await expect(market.settle(index)).to.be.revertedWith(
				"_settle: Payout date not reached"
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			expect(await market.settle(index)).to.emit(market, "Settled");

			const vaultBalanceAfter = await underlying.balanceOf(vault.address);

			const bet = await market.getBetByIndex(0);
			expect(vaultBalanceAfter).to.equal(vaultBalanceBefore.add(bet[1]));
		});

		it("Should settle bobs winning bet by index", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const close = 0;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 1 for a Win
			const nonce = "1";
			const propositionId = makePropositionId("ABC", 1);
			const marketId = makeMarketId(new Date(), "ABC", "1");

			const betSignature = await signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			let count = await market.getCount();
			expect(count, "There should be no bets").to.equal(0);

			expect(
				await market
					.connect(bob)
					.back(
						formatBytes16String(nonce),
						formatBytes16String(propositionId),
						formatBytes16String(marketId),
						wager,
						odds,
						close,
						end,
						betSignature
					)
			).to.emit(market, "Placed");

			count = await market.getCount();
			expect(count).to.equal(1, "There should be 1 bet");

			const bet = await market.getBetByIndex(0);
			const betAmount = bet[0];
			const betPayout = bet[1];

			expect(betAmount, "Bet amount should be same as wager").to.equal(wager);

			const inPlayCount = await market.getInPlayCount();
			expect(inPlayCount, "In play count should be 1").to.equal(1);

			let exposure = await market.getTotalExposure();
			expect(
				exposure,
				"Exposure should be equal to the payout less the wager"
			).to.equal(betPayout.sub(wager));

			let inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(ethers.utils.parseUnits("100", USDT_DECIMALS));

			const bobBalance = await underlying.balanceOf(bob.address);
			const nftBalance = await market.balanceOf(bob.address);
			expect(nftBalance).to.equal(1, "Bob should have 1 NFT");

			const signature = await signSetResultMessage(
				marketId,
				propositionId,
				oracleSigner
			);
			const oracleOwner = await oracle.getOwner();
			expect(oracleOwner).to.equal(oracleSigner.address);
			await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(propositionId),
				signature
			);
			const index = 0;
			await expect(market.settle(index)).to.be.revertedWith(
				"_settle: Payout date not reached"
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			expect(await market.settle(index))
				.to.emit(market, "Settled")
				.withArgs(index, betPayout, true, bob.address);

			const newNftBalance = await market.balanceOf(bob.address);
			expect(newNftBalance).to.equal(0, "Bob should have no NFTs now");

			await expect(market.settle(index)).to.be.revertedWith(
				"settle: Bet has already settled"
			);
			exposure = await market.getTotalExposure();
			expect(exposure).to.equal(0);

			inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(0);

			const balance = await underlying.balanceOf(bob.address);
			expect(balance).to.equal(bobBalance.add(betPayout));
		});

		it("Should payout wage after timeout has been reached", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const close = 0;
			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 1 for a Win
			const marketId = makeMarketId(new Date(), "ABC", "1");
			const propositionId = makePropositionId(marketId, 1);
			const nonce = "1";

			const betSignature = await signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			const index = 0;
			expect(
				await market
					.connect(bob)
					.back(
						formatBytes16String(nonce),
						formatBytes16String(propositionId),
						formatBytes16String(marketId),
						wager,
						odds,
						close,
						end,
						betSignature
					),
				"Should emit a Placed event"
			)
				.to.emit(market, "Placed")
				.withArgs(
					index,
					formatBytes16String(propositionId),
					formatBytes16String(marketId),
					wager,
					272727300,
					bob.address
				);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 31 * 24 * 60 * 60]
			});

			expect(await market.settle(index), "Should emit a Settled event")
				.to.emit(market, "Settled")
				.withArgs(index, 272727300, true, bob.address);

			console.log("Test complete");
		});

		it("Should settle multiple bets on a market", async () => {
			const baseWager = ethers.utils.parseUnits("10", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
			const close = 0;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;
			const marketId = makeMarketId(new Date(), "ABC", "1");
			const max = 5;

			for (let i = 0; i < max; i++) {
				const marketBalance = await underlying.balanceOf(market.address);
				console.log("test: marketBalance", formatUnits(marketBalance, 6));
				const nonce = i.toString();
				const propositionId = makePropositionId("ABC", i + 1);
				const wager = baseWager.mul(i + 1);

				const betSignature = await signBackMessage(
					nonce,
					marketId,
					propositionId,
					odds,
					close,
					end,
					owner
				);

				expect(
					await market
						.connect(bob)
						.back(
							formatBytes16String(nonce),
							formatBytes16String(propositionId),
							formatBytes16String(marketId),
							wager,
							odds,
							close,
							end,
							betSignature
						)
				).to.emit(market, "Placed");

				const count = await market.getCount();
				expect(count).to.equal(i + 1, "There should be more bets");

				const bet = await market.getBetByIndex(i);
				expect(bet[0]).to.equal(wager, "Bet amount should be same as wager");
			}
			const marketBalance = await underlying.balanceOf(market.address);

			let inPlayCount = await market.getInPlayCount();
			expect(inPlayCount, "In play count should be 10").to.equal(max);

			// add a result
			const propositionId = makePropositionId("ABC", 1);
			const signature = await signSetResultMessage(
				marketId,
				propositionId,
				oracleSigner
			);

			const oracleOwner = await oracle.getOwner();
			expect(oracleOwner).to.equal(oracleSigner.address);
			await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(propositionId),
				signature
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			await market.settleMarket(formatBytes16String(marketId));

			inPlayCount = await market.getInPlayCount();
			const marketCover = await market.getTotalExposure();
			expect(marketCover, "Total exposure should be zero now").to.equal(0);
			expect(inPlayCount).to.equal(0);
		});
	});

	describe("ACL", () => {
		it("Should not be a valid signer", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			const isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(false);
		});

		it("Should allow a new signer to be granted by owner", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await market.connect(owner).grantSigner(newSigner.address);
			const isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(true);
		});

		it("Should not allow alice to grant a new signer", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await expect(
				market.connect(alice).grantSigner(newSigner.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should allow a new signer to be revoked by owner", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await market.connect(owner).grantSigner(newSigner.address);
			let isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(true);

			await market.connect(owner).revokeSigner(newSigner.address);
			isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(false);
		});
	});

	describe("Risky Markets", () => {
		it.skip("Should account for market risk coefficient", async () => {
			const wager = ethers.utils.parseUnits("50", USDT_DECIMALS);
			const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const propositionId = makePropositionId("ABC", 1);
			const marketId = makeMarketId(new Date(), "ABC", "1");

			const calculatedOdds = await market.getOdds(
				wager,
				targetOdds,
				formatBytes16String(propositionId),
				formatBytes16String(marketId)
			);

			expect(calculatedOdds).to.be.closeTo(BigNumber.from(3809524), 1);
		});
	});
});
