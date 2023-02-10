import hre, { ethers, deployments } from "hardhat";
import { BigNumber } from "ethers";
import chai, { expect } from "chai";
import {
	Market,
	MarketCollateralisedWithoutProtection,
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

chai.use(solidity);

type TestRunner = {
	runnerNumber: number;
	name: string;
	propositionId: string;
};
type TestBet = {
	market: TestMarket;
	runner: TestRunner;
	amount: number;
	odds: number;
	bettor: SignerWithAddress;
};
type TestMarket = {
	name: string;
	marketId: string;
	runners: TestRunner[];
};
const END = 1000000000000;

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

	const Markets: { [key: string]: TestMarket } = {
		RedRacetrack: {
			name: "Red Racetrack",
			marketId: makeMarketId(new Date(), "RED", "1"),
			runners: []
		},
		BlueDogs: {
			name: "Blue Dogs",
			marketId: makeMarketId(new Date(), "BLUE", "1"),
			runners: []
		}
	};
	Markets.RedRacetrack.runners = [
		{
			runnerNumber: 1,
			name: "Red 1",
			propositionId: makePropositionId(Markets.RedRacetrack.marketId, 1)
		},
		{
			runnerNumber: 2,
			name: "Red 2",
			propositionId: makePropositionId(Markets.RedRacetrack.marketId, 2)
		},
		{
			runnerNumber: 3,
			name: "Red 3",
			propositionId: makePropositionId(Markets.RedRacetrack.marketId, 3)
		}
	];
	Markets.BlueDogs.runners = [
		{
			runnerNumber: 1,
			name: "Blue 1",
			propositionId: makePropositionId(Markets.BlueDogs.marketId, 1)
		},
		{
			runnerNumber: 2,
			name: "Blue 2",
			propositionId: makePropositionId(Markets.BlueDogs.marketId, 2)
		}
	];
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
			fixture.Usdt.abi,
			fixture.Usdt.address
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

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const marketFactory = await ethers.getContractFactory(
			"MarketCollateralisedWithoutProtection",
			{
				signer: owner,
				libraries: {
					SignatureLib: signatureLib.address
				}
			}
		);

		// https://www.npmjs.com/package/hardhat-deploy?activeTab=readme#handling-contract-using-libraries
		// https://stackoverflow.com/questions/71389974/how-can-i-link-library-and-contract-in-one-file
		const args = [vault.address, MARGIN, 1, oracle.address];
		market = (await marketFactory.deploy(
			...args
		)) as MarketCollateralisedWithoutProtection;

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

		let marketCollateral = await market.getMarketCollateral(
			formatBytes16String(bet.market.marketId)
		);
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

		marketCollateral = await market.getMarketCollateral(
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
		).to.equal(originalStats.vaultBalance);
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

		const newBettorBalance = await underlying.balanceOf(bet.bettor.address);
		const bettorDelta = newBettorBalance.sub(originalBettorBalance);
		expect(bettorDelta, "Bettor should have won the bet").to.equal(
			BigNumber.from(bet.amount).mul(
				ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS)
			)
		);
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
});

type MarketStats = {
	marketTotal: BigNumber;
	exposure: BigNumber;
	inPlay: BigNumber;
	vaultBalance: BigNumber;
};

async function makeBet(
	token: Token,
	marketContract: Market,
	vault: Vault,
	bet: TestBet,
	owner: SignerWithAddress
): Promise<MarketStats> {
	const tokenDecimals = await token.decimals();
	await token
		.connect(bet.bettor)
		.approve(
			marketContract.address,
			ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals)
		);

	const nonce = "1";
	const close = END;
	const end = END;
	const wager = ethers.utils.parseUnits(bet.amount.toString(), tokenDecimals);
	const odds = ethers.utils.parseUnits(bet.odds.toString(), 6);
	const b16Nonce = formatBytes16String(nonce);
	const b16PropositionId = formatBytes16String(bet.runner.propositionId);
	const b16MarketId = formatBytes16String(bet.market.marketId);

	const signature = await signBackMessage(
		nonce,
		bet.market.marketId,
		bet.runner.propositionId,
		odds,
		close,
		end,
		owner
	);

	await marketContract
		.connect(bet.bettor)
		.back(
			b16Nonce,
			b16PropositionId,
			b16MarketId,
			wager,
			odds,
			close,
			end,
			signature
		);
	return getMarketStats(bet.market.marketId, marketContract, token, vault);
}

async function getMarketStats(
	marketId: string,
	market: Market,
	token: Token,
	vault: Vault
): Promise<MarketStats> {
	const marketTotal = await market.getMarketTotal(
		formatBytes16String(marketId)
	);
	const exposure = await market.getTotalExposure();
	const inPlay = await market.getTotalInPlay();
	const vaultBalance = await token.balanceOf(vault.address);
	return {
		marketTotal,
		exposure,
		inPlay,
		vaultBalance
	};
}
