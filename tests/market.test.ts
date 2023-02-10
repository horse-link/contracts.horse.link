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
import { formatBytes16String, makeMarketId, makePropositionId } from "./utils";

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
	const WINNER = 0x01;
	const SCRATCHED = 0x03;

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
		const currentTime = await time.latest();
		// Assume race closes in 1 hour from now
		const close = currentTime + 3600;
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
		expect(balance, "Carol balance should be correct").to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("200", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
		const currentTime = await time.latest();
		// Assume race closes in 1 hour from now
		const close = currentTime + 3600;
		const end = 1000000000000;

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
		expect(balance, "Should have $800 USDT after a $200 bet").to.equal(
			ethers.utils.parseUnits("800", USDT_DECIMALS)
		);
	});

	it("Should not allow Carol a $200 punt at 2:1 after the race close time", async () => {
		const balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("200", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
		const currentTime = await time.latest();
		// Assume race closes in 1 hour from now
		const close = currentTime + 3600;
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

		// Move time to 1 second past the close
		await time.increaseTo(close + 1);

		await expect(
			market
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
				)
		).to.be.revertedWith("back: Invalid date");
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
		const currentTime = await time.latest();
		// Assume race closes in 1 hour from now
		const close = currentTime + 3600;

		// Whale makes a bet but he doesn't care if he loses
		const latestBlockNumber = await ethers.provider.getBlockNumber();
		const latestBlock = await ethers.provider.getBlock(latestBlockNumber);
		const end = latestBlock.timestamp + 10000;
		const propositionId = makePropositionId("ABC", 1);
		const winningPropositionId = makePropositionId("ABC", 2);
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
			winningPropositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(marketId),
			formatBytes16String(winningPropositionId),
			signature
		);
		const vaultBalanceBeforeSettlement = await underlying.balanceOf(
			vault.address
		);
		await market.connect(alice).settle(0);

		// Vault should have received the wager plus the winnings
		expect(
			await underlying.balanceOf(vault.address),
			"Vault didn't receive funds from the Market"
		).to.be.gt(vaultBalanceBeforeSettlement);

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
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;
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
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

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
			const nftMetaDataURI = await market.tokenURI(0);
			expect(nftMetaDataURI.toLowerCase()).to.equal(
				`https://horse.link/api/bets/${market.address.toLowerCase()}/0`
			);

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

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			expect(await market.settle(index))
				.to.emit(market, "Settled")
				.withArgs(index, betPayout, WINNER, bob.address);

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

		it("Should settle bobs scratched bet by index", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const totalOdds = odds.mul(5);
			const currentTime = await time.latest();
			const bobBalance = await underlying.balanceOf(bob.address);
			const vaultBalance = await underlying.balanceOf(vault.address);
			const marketBalance = await underlying.balanceOf(market.address);
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

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

			const nftBalance = await market.balanceOf(bob.address);
			expect(nftBalance).to.equal(1, "Bob should have 1 NFT");

			// This signature is for a scratched result/propositionId
			const signature = await signSetScratchedMessage(
				marketId,
				propositionId,
				odds,
				totalOdds,
				oracleSigner
			);
			const oracleOwner = await oracle.getOwner();
			expect(oracleOwner).to.equal(oracleSigner.address);
			await oracle.setScratchedResult(
				formatBytes16String(marketId),
				formatBytes16String(propositionId),
				odds,
				totalOdds,
				signature
			);
			const index = 0;

			// Scratched bets do not need to wait for the race to finsih
			expect(await market.settle(index), "Issue with settling scratched bet")
				.to.emit(market, "Settled")
				.withArgs(index, betPayout, SCRATCHED, bob.address);

			const newNftBalance = await market.balanceOf(bob.address);
			expect(newNftBalance).to.equal(0, "Bob should have no NFTs now");

			await expect(market.settle(index)).to.be.revertedWith(
				"settle: Bet has already settled"
			);
			exposure = await market.getTotalExposure();
			expect(exposure).to.equal(0);

			inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(0);

			// Everything should be as it was before
			const balance = await underlying.balanceOf(bob.address);
			const endVaultBalance = await underlying.balanceOf(vault.address);
			const endMarketBalance = await underlying.balanceOf(market.address);
			expect(balance).to.equal(bobBalance);
			expect(vaultBalance).to.equal(endVaultBalance);
			expect(marketBalance).to.equal(endMarketBalance);
		});

		it("Should allow Bob to transfer a punt to Carol and for Carol to settle", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

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

			const carolBalance = await underlying.balanceOf(carol.address);
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

			// Send NFT to Carol
			await market.connect(bob).transferFrom(bob.address, carol.address, index);
			const carolNftBalance = await market.balanceOf(carol.address);
			expect(carolNftBalance).to.equal(1, "Carol should have 1 NFT");

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			expect(await market.connect(carol).settle(index))
				.to.emit(market, "Settled")
				.withArgs(index, betPayout, WINNER, carol.address);

			const newNftBalance = await market.balanceOf(carol.address);
			expect(newNftBalance).to.equal(0, "Carol should have no NFTs now");

			await expect(market.settle(index)).to.be.revertedWith(
				"settle: Bet has already settled"
			);
			exposure = await market.getTotalExposure();
			expect(exposure).to.equal(0);

			inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(0);

			const balance = await underlying.balanceOf(carol.address);
			expect(balance).to.equal(carolBalance.add(betPayout));
		});

		it("Should payout wage after timeout has been reached", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;
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
				.withArgs(index, 272727300, WINNER, bob.address);
		});

		it("Should settle multiple bets on a market", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;
			const marketId = makeMarketId(new Date(), "ABC", "1");
			const max = 5;

			for (let i = 0; i < max; i++) {
				const nonce = i.toString();
				const propositionId = makePropositionId("ABC", i + 1);
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

const signMessageAsString = async (
	message: string,
	signer: SignerWithAddress
) => {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	return sig;
};

const signMessage = async (
	message: string,
	signer: SignerWithAddress
): Promise<Signature> => {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	const { v, r, s } = ethers.utils.splitSignature(sig);
	return { v, r, s };
};

const makeSetResultMessage = (
	marketId: string,
	propositionId: string
): string => {
	const b16MarketId = formatBytes16String(marketId);
	const b16PropositionId = formatBytes16String(propositionId);
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16"],
		[b16MarketId, b16PropositionId]
	);
	return message;
};

const makeSetScratchMessage = (
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	totalOdds: BigNumber
): string => {
	const b16MarketId = formatBytes16String(marketId);
	const b16PropositionId = formatBytes16String(propositionId);
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16", "uint256", "uint256"],
		[b16MarketId, b16PropositionId, odds, totalOdds]
	);
	return message;
};

const signSetResultMessage = async (
	marketId: string,
	propositionId: string,
	signer: SignerWithAddress
): Promise<Signature> => {
	const settleMessage = makeSetResultMessage(marketId, propositionId);
	return await signMessage(settleMessage, signer);
};

const signSetScratchedMessage = async (
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	totalOdds: BigNumber,
	signer: SignerWithAddress
): Promise<Signature> => {
	const settleMessage = makeSetScratchMessage(
		marketId,
		propositionId,
		odds,
		totalOdds
	);
	return await signMessage(settleMessage, signer);
};

const signBackMessage = async (
	nonce: string,
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	close: number,
	end: number,
	signer: SignerWithAddress
): Promise<Signature> => {
	const message = ethers.utils.solidityKeccak256(
		[
			"bytes16", // nonce
			"bytes16", // propositionId
			"bytes16", // marketId
			"uint256", // odds
			"uint256", // close
			"uint256" // end
		],
		[
			formatBytes16String(nonce),
			formatBytes16String(propositionId),
			formatBytes16String(marketId),
			odds,
			close,
			end
		]
	);
	return await signMessage(message, signer);
};

const signBackMessageWithRisk = async (
	nonce: string,
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	close: number,
	end: number,
	risk: number,
	signer: SignerWithAddress
): Promise<Signature> => {
	const message = ethers.utils.solidityKeccak256(
		[
			"bytes16", // nonce
			"bytes16", // propositionId
			"bytes16", // marketId
			"uint256", // odds
			"uint256", // close
			"uint256", // end
			"uint256" // risk
		],
		[
			formatBytes16String(nonce),
			formatBytes16String(propositionId),
			formatBytes16String(marketId),
			odds,
			close,
			end,
			risk
		]
	);
	return await signMessage(message, signer);
};
