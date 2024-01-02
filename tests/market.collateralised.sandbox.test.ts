import { ethers, deployments } from "hardhat";
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
import { getMarketStats, makeBet, TestBet, TestMarket } from "./utils";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { markets } from "horselink-sdk";

chai.use(solidity);

describe.skip("Collateralised Market: catch 505", function () {
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
			marketId: "20240101RED1W", // 2024 Jan 1st, RED, 1, WIN
			runners: []
		},
		BlueDogs: {
			name: "Blue Dogs",
			marketId: "20240101BNE1W", // 2024 Jan 1st, RED, 1, WIN
			runners: []
		}
	};
	Markets.RedRacetrack.runners = [
		{
			runnerNumber: 1,
			name: "Red 1",
			propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 1)
		},
		{
			runnerNumber: 2,
			name: "Red 2",
			propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 2)
		},
		{
			runnerNumber: 3,
			name: "Red 3",
			propositionId: markets.makePropositionId(Markets.RedRacetrack.marketId, 3)
		}
	];
	Markets.BlueDogs.runners = [
		{
			runnerNumber: 1,
			name: "Blue 1",
			propositionId: markets.makePropositionId(Markets.BlueDogs.marketId, 1)
		},
		{
			runnerNumber: 2,
			name: "Blue 2",
			propositionId: markets.makePropositionId(Markets.BlueDogs.marketId, 2)
		}
	];

	const MARGIN = 100;

	beforeEach(async () => {
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
			"https://example.org/"
		];
		market = (await marketFactory.deploy(
			...args
		)) as MarketCollateralisedWithoutProtection;

		await vault.setMarket(market.address, 1, ethers.constants.MaxUint256);
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

	it("Expired bets", async () => {
		const shouldBeLoser1: TestBet = {
			bettor: alice,
			market: Markets.RedRacetrack,
			runner: Markets.RedRacetrack.runners[0],
			amount: 1000,
			odds: 50
		};
		const shouldBeWinner2: TestBet = {
			bettor: alice,
			market: Markets.RedRacetrack,
			runner: Markets.RedRacetrack.runners[1],
			amount: 1000,
			odds: 50
		};

		const bets = [shouldBeLoser1, shouldBeWinner2];
		let stats; //: MarketStats;
		console.log("=== Making bets ===");
		for (const bet of bets) {
			stats = await makeBet(underlying, market, vault, bet, owner);
			showStats(stats);
		}

		console.log("=== Waiting for bets to expire ===");

		// Wait for the bets to expire
		await time.increase(86400 * 365);
		const newTimeStamp = await time.latest();
		console.log("New time: ", new Date(newTimeStamp * 1000));
		stats = await getMarketStats(
			bets[0].market.marketId,
			market,
			underlying,
			vault
		);
		showStats(stats);

		// Settle them
		console.log("=== Settling bets ===");

		for (let i = 0; i < bets.length; i++) {
			try {
				await market.settle(i);
			} catch (e) {
				console.error("Error settling bet: ", e);
			}

			showStats(stats);
		}

		const newBet: TestBet = {
			bettor: alice,
			market: Markets.BlueDogs,
			runner: Markets.BlueDogs.runners[0],
			amount: 100,
			odds: 200
		};

		stats = await makeBet(
			underlying,
			market,
			vault,
			newBet,
			owner,
			newTimeStamp + 10000
		);

		const newBet2: TestBet = {
			bettor: alice,
			market: Markets.BlueDogs,
			runner: Markets.BlueDogs.runners[1],
			amount: 1,
			odds: 20
		};

		stats = await makeBet(
			underlying,
			market,
			vault,
			newBet2,
			owner,
			newTimeStamp + 10000
		);
		showStats(stats);
	});
});

function showStats(stats: any) {
	console.log("Market stats:");
	console.log("Market total: ", stats.marketTotal.toString());
	console.log("Exposure: ", stats.exposure.toString());
}
