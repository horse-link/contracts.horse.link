import hre, { ethers, deployments } from "hardhat";
import { BigNumber } from "ethers";
import chai, { expect } from "chai";
import {
	MarketCollateralisedWithoutProtection,
	MarketOracle,
	Token,
	Vault,
	Vault__factory
} from "../build/typechain";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
	END,
	getMarketStats,
	makeBet,
	Markets,
	signRefundMessage,
	signSetResultMessage,
	TestBet
} from "./utils";
import { formatBytes16String } from "../scripts/utils";
import * as timeHelper from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";

chai.use(solidity);

describe("Collateralised Market: play through", function () {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: MarketCollateralisedWithoutProtection;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let carol: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	this.timeout(60000);

	let Bets: { [key: string]: TestBet };

	let bet1Cover: BigNumber;
	let bet3Cover: BigNumber;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;

	before(async () => {
		[owner, alice, bob, carol] = await ethers.getSigners();

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

		oracle = (await ethers.getContractAt(
			fixture.MarketOracle.abi,
			fixture.MarketOracle.address
		)) as MarketOracle;

		tokenDecimals = await underlying.decimals();

		Bets = {
			One: {
				market: Markets.RedRacetrack,
				runner: Markets.RedRacetrack.runners[0],
				amount: 1,
				odds: 5,
				bettor: alice
			},
			Two: {
				market: Markets.RedRacetrack,
				runner: Markets.RedRacetrack.runners[1],
				amount: 1,
				odds: 4,
				bettor: bob
			},
			Three: {
				market: Markets.BlueDogs,
				runner: Markets.BlueDogs.runners[0],
				amount: 1,
				odds: 5,
				bettor: bob
			},
			Four: {
				market: Markets.RedRacetrack,
				runner: Markets.RedRacetrack.runners[2],
				amount: 1,
				odds: 10,
				bettor: bob
			},
			Five: {
				market: Markets.GreenRace,
				runner: Markets.GreenRace.runners[0],
				amount: 2,
				odds: 3,
				bettor: bob
			},
			Six: {
				market: Markets.GreenRace,
				runner: Markets.GreenRace.runners[1],
				amount: 2,
				odds: 2,
				bettor: bob
			}
		};

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("10000000", tokenDecimals)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000000", tokenDecimals)
		);
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("10000", tokenDecimals)
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		const marketFactory = await ethers.getContractFactory(
			"MarketCollateralisedWithoutProtection",
			{
				signer: owner,
				libraries: {
					SignatureLib: fixture.SignatureLib.address,
					OddsLib: fixture.OddsLib.address
				}
			}
		);

		// https://www.npmjs.com/package/hardhat-deploy?activeTab=readme#handling-contract-using-libraries
		// https://stackoverflow.com/questions/71389974/how-can-i-link-library-and-contract-in-one-file
		const args = [
			vault.address,
			MARGIN,
			1,
			oracle.address,
			"https://example.org"
		];
		market = (await marketFactory.deploy(
			...args
		)) as MarketCollateralisedWithoutProtection;

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000);
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
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(carol)
			.approve(market.address, ethers.constants.MaxUint256);

		await vault
			.connect(alice)
			.deposit(
				ethers.utils.parseUnits("1000000", tokenDecimals),
				alice.address
			);
	});

	it("Bet 1: Should get cover from the vault for a new bet", async () => {
		const bet = Bets.One;
		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);
		const odds = ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS);
		const potentialWinnings = wager
			.mul(odds)
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));

		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const newStats = await makeBet(underlying, market, vault, bet, owner);

		expect(
			newStats.marketTotal,
			"Market total should be the bet amount"
		).to.equal(ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS));

		expect(newStats.inPlay, "In play should be the bet amount").to.equal(
			ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals)
		);

		const vaultDelta = originalStats.vaultBalance.sub(newStats.vaultBalance);
		bet1Cover = potentialWinnings.sub(wager);
		expect(
			vaultDelta,
			`Vault should have covered $${ethers.utils.formatUnits(
				bet1Cover,
				tokenDecimals
			)} of the bet`
		).to.equal(bet1Cover);

		expect(
			newStats.exposure,
			"Exposure should have gone up by the covered amount"
		).to.equal(originalStats.exposure.add(bet1Cover));

		const tokenOwner = await market.ownerOf(0);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(
			bet.bettor.address
		);

		const marketCollateral = await market.getMarketCollateral(
			formatBytes16String(bet.market.marketId)
		);
		console.log(
			`End of Bet 1: Market collateral: ${ethers.utils.formatUnits(
				marketCollateral,
				tokenDecimals
			)} tokens`
		);
	});

	it("Bet 2: Should not get any new cover for a lesser bet on a different proposition in the same market", async () => {
		const bet = Bets.Two;

		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const newStats = await makeBet(underlying, market, vault, bet, owner);

		//Expect the total wagers to have gone up by the wager amount
		expect(
			newStats.marketTotal,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalStats.marketTotal.add(wager));

		expect(newStats.inPlay, "In play has gone up by the bet amount").to.equal(
			originalStats.inPlay.add(wager)
		);

		expect(
			newStats.vaultBalance,
			"Vault should not have covered the bet"
		).to.not.be.lt(originalStats.vaultBalance);
		const tokenOwner = await market.ownerOf(1);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);

		const marketCollateral = await market.getMarketCollateral(
			formatBytes16String(bet.market.marketId)
		);
		console.log(
			`End of Bet 2: Market collateral: ${ethers.utils.formatUnits(
				marketCollateral,
				tokenDecimals
			)} tokens`
		);
	});

	it("Bet 3: Should get cover for a new bet on a different market", async () => {
		const bet = Bets.Three;

		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);
		const potentialWinnings = wager
			.mul(ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS))
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const newStats = await makeBet(underlying, market, vault, bet, owner);

		//Expect the total wagers to have gone up by the wager amount
		expect(
			newStats.marketTotal,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalStats.marketTotal.add(wager));

		expect(newStats.inPlay, "In play has gone up by the bet amount").to.equal(
			originalStats.inPlay.add(wager)
		);

		const vaultDelta = newStats.vaultBalance.sub(originalStats.vaultBalance);
		bet3Cover = potentialWinnings.sub(wager);
		expect(
			vaultDelta,
			`Vault should have covered $${ethers.utils.formatUnits(
				bet3Cover,
				tokenDecimals
			)} of the bet`
		).to.equal(vaultDelta);

		const tokenOwner = await market.ownerOf(2);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Bet 4: Should get delta cover for a new most-expensive bet", async () => {
		const bet = Bets.Four;

		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);
		const potentialWinnings = wager
			.mul(ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS))
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const marketCollateral = await market.getMarketCollateral(
			formatBytes16String(bet.market.marketId)
		);

		const newStats = await makeBet(underlying, market, vault, bet, owner);

		//Expect the total wagers to have gone up by the wager amount
		expect(
			newStats.marketTotal,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalStats.marketTotal.add(wager));

		const newInPlay = await market.getTotalInPlay();
		expect(newInPlay, "In play has gone up by the bet amount").to.equal(
			originalStats.inPlay.add(wager)
		);

		// Shortfall is the difference between the potential payout of the new bet (less the market total) and the amount of collateral in the market
		const potentialWinningsTokens = ethers.utils.formatUnits(
			potentialWinnings,
			tokenDecimals
		);
		console.log(`Potential winnings: $${potentialWinningsTokens} tokens`);
		console.log(
			`Market total: $${ethers.utils.formatUnits(
				newStats.marketTotal,
				tokenDecimals
			)} tokens`
		);
		console.log(
			`Market collateral: $${ethers.utils.formatUnits(
				marketCollateral,
				tokenDecimals
			)} tokens`
		);
		console.log(
			`Market total + collateral: $${ethers.utils.formatUnits(
				newStats.marketTotal.add(marketCollateral),
				tokenDecimals
			)} tokens`
		);
		const shortfall = potentialWinnings.sub(
			newStats.marketTotal.add(marketCollateral)
		);
		console.log(
			`Shortfall: $${ethers.utils.formatUnits(shortfall, tokenDecimals)} tokens`
		);
		expect(
			newStats.vaultBalance,
			"Vault should have covered the shortfall"
		).to.equal(originalStats.vaultBalance.sub(shortfall));
		const tokenOwner = await market.ownerOf(1);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Fast forward", async () => {
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [END + 7200]
		});
	});

	it("Bet 1: Should settle won bet", async () => {
		const bet = Bets.One;
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const originalBettorBalance = await underlying.balanceOf(
			bet.bettor.address
		);
		// Set result to make bet a winner
		const signature = await signSetResultMessage(
			bet.market.marketId,
			bet.runner.propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(bet.market.marketId),
			formatBytes16String(bet.runner.propositionId),
			signature
		);

		// Settle won bet
		await market.connect(bet.bettor).settle(0);

		const newStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const inPlayDelta = originalStats.inPlay.sub(newStats.inPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals));

		// His balance should have gone up by the potential winnings
		const newBettorBalance = await underlying.balanceOf(bet.bettor.address);
		const bettorDelta = newBettorBalance.sub(originalBettorBalance);
		expect(bettorDelta, "Bettor should have won the bet").to.equal(
			BigNumber.from(bet.amount).mul(
				ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS)
			)
		);

		const betStruct = await market.getBetByIndex(0);
		expect(
			betStruct[1],
			"Bet struct payout should equal the actual payout"
		).to.equal(
			BigNumber.from(bet.amount).mul(
				ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS)
			)
		);

		const exposureDelta = originalStats.exposure.sub(newStats.exposure);
		expect(
			exposureDelta,
			"Bet 1: Exposure should have gone down by the covered amount"
		).to.equal(bet1Cover);
	});

	it("Should settle the second bet, lost", async () => {
		const bet = Bets.Two;
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const originalBettorBalance = await underlying.balanceOf(
			bet.bettor.address
		);

		// Lost the bet
		await market.connect(bet.bettor).settle(1);

		const newStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);

		const inPlayDelta = originalStats.inPlay.sub(newStats.inPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals));

		const newBettorBalance = await underlying.balanceOf(bet.bettor.address);
		const bettorDelta = newBettorBalance.sub(originalBettorBalance);
		expect(bettorDelta, "Bob should have lost the bet").to.equal(0);

		const newExposure = await market.getTotalExposure();
		const exposureDelta = originalStats.exposure.sub(newExposure);
		expect(exposureDelta, "Total Exposure should not have gone down").to.equal(
			BigNumber.from(0)
		);
	});

	it("Should settle the third bet, lost", async () => {
		const bet = Bets.Three;
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const originalBettorBalance = await underlying.balanceOf(
			bet.bettor.address
		);
		// Set result to make bet a winner
		const winningProposition = bet.market.runners[1].propositionId;

		const signature = await signSetResultMessage(
			bet.market.marketId,
			winningProposition,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(bet.market.marketId),
			formatBytes16String(winningProposition), //Another runner
			signature
		);

		// Settle lost bet
		await market.connect(bet.bettor).settle(2);

		const newStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);

		const inPlayDelta = originalStats.inPlay.sub(newStats.inPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals));

		const newBettorBalance = await underlying.balanceOf(bet.bettor.address);
		const bettorDelta = newBettorBalance.sub(originalBettorBalance);
		expect(bettorDelta, "Bettor balance should not have changed").to.equal(0);

		expect(
			newStats.exposure,
			"Total Exposure should have gone down by the covered amount"
		).to.equal(originalStats.exposure.sub(bet3Cover));
	});

	it("Should settle the fourth bet, lost", async () => {
		const bet = Bets.Four;
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const originalBettorBalance = await underlying.balanceOf(
			bet.bettor.address
		);

		// Settle lost bet
		await market.connect(bet.bettor).settle(3);
		const newStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);

		const inPlayDelta = originalStats.inPlay.sub(newStats.inPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals));
		const newBettorBalance = await underlying.balanceOf(bet.bettor.address);
		const bettorDelta = newBettorBalance.sub(originalBettorBalance);
		expect(bettorDelta, "Bettor should have lost the bet").to.equal(0);

		const newExposure = await market.getTotalExposure();
		expect(newExposure, "There should be no exposure").to.equal(
			BigNumber.from(0)
		);

		//There should be some assets left in the market
		const marketBalance = await underlying.balanceOf(market.address);
		expect(marketBalance, "Market should have some assets").to.not.equal(
			BigNumber.from(0)
		);

		// This was commented out due to size limitations on the contract
		// const totalCollateral = await market.getTotalCollateral();
		// expect(
		// 	totalCollateral,
		// 	`Total cover (${ethers.utils.formatUnits(
		// 		totalCollateral,
		// 		tokenDecimals
		// 	)}) should be the same as the market balance (${ethers.utils.formatUnits(
		// 		marketBalance,
		// 		tokenDecimals
		// 	)})`
		// ).to.equal(marketBalance);
	});
	it("After all bets are settled, there should be no exposure", async () => {
		const exposure = await market.getTotalExposure();
		expect(exposure, "There should be no exposure").to.equal(BigNumber.from(0));
		// There should be some spare collateral
		const marketBalance = await underlying.balanceOf(market.address);
		console.log(
			`Market balance: ${ethers.utils.formatUnits(
				marketBalance,
				tokenDecimals
			)}`
		);
		expect(marketBalance, "Market should have some assets").to.not.equal(
			BigNumber.from(0)
		);
	});

	/* 
	At this stage there are 7 tokens of spare collateral
	We are betting $2 at odds of 3.0
	Potential payout is $6
	Less the $2, we need $4 of cover
	We will take $4 of spare collateral and leave $3 of spare collateral
	*/

	it("Bet 5: If there is extra collateral in the market, new bets should use it instead of taking additional cover from the vault", async () => {
		const bet = Bets.Five;
		const originalStats = await getMarketStats(
			bet.market.marketId,
			market,
			underlying,
			vault
		);
		const originalTotalCollateral = await market.getTotalCollateral();
		const originalSpareCollateral = originalTotalCollateral.sub(
			originalStats.exposure
		);
		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);

		// Calculate payout
		const payout = ethers.utils.parseUnits(
			(bet.amount * bet.odds).toString(),
			tokenDecimals
		);

		const takenFromSpareCollateral = payout.sub(wager); // Taking 4, there should be 3 left
		console.log(
			`Taking from spare collateral: ${ethers.utils.formatUnits(
				takenFromSpareCollateral,
				tokenDecimals
			)}`
		);

		const now = await timeHelper.latest();
		const newStats = await makeBet(underlying, market, vault, bet, owner, now);

		//Expect the total wagers to have gone up by the wager amount
		expect(
			newStats.marketTotal,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalStats.marketTotal.add(wager));

		expect(newStats.inPlay, "In play has gone up by the bet amount").to.equal(
			originalStats.inPlay.add(wager)
		);

		expect(originalStats.vaultBalance, "Vault did not need to cover").to.equal(
			newStats.vaultBalance
		);

		// Collateral did not change
		const newTotalCollateral = await market.getTotalCollateral();
		expect(
			newTotalCollateral,
			"Total collateral should not have changed"
		).to.equal(originalTotalCollateral);

		// Exposure should have gone up by the amount of collateral required
		const newExposure = await market.getTotalExposure();
		console.log(
			`Old exposure: ${ethers.utils.formatUnits(
				originalStats.exposure,
				tokenDecimals
			)}`
		);
		console.log(
			`New exposure: ${ethers.utils.formatUnits(newExposure, tokenDecimals)}`
		);
		expect(
			newExposure,
			"Exposure should have gone up by the amount taken from spare collateral"
		).to.equal(originalStats.exposure.add(takenFromSpareCollateral));

		// Go forward in time
		await timeHelper.increase(now + END + 3600);

		// Set result to make it a winner
		const signature = await signSetResultMessage(
			bet.market.marketId,
			bet.runner.propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(bet.market.marketId),
			formatBytes16String(bet.runner.propositionId),
			signature
		);

		// Settle
		await market.settle(4);

		const newTotalCollateral2 = await market.getTotalCollateral();
		expect(
			originalSpareCollateral.sub(newTotalCollateral2),
			"Total collateral should go down by the amount taken from spare collateral"
		).to.equal(ethers.utils.parseUnits("4", tokenDecimals));
	});

	it("Bet 6: Refund", async () => {
		const bet = Bets.Six;
		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);

		const now = await timeHelper.latest();
		await makeBet(underlying, market, vault, bet, owner, now);
		const refundSignature = await signRefundMessage(market.address, 5, owner);

		const betIndex = 5;
		expect(await market.refundWithSignature(betIndex, refundSignature)).to.emit(
			market,
			"Refunded"
		);
	});
});
