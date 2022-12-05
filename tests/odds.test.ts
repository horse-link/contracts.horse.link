import hre, { ethers, deployments } from "hardhat";
import chai, { expect } from "chai";
import { OddsLib } from "../build/typechain";
import { loadFixture, solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { formatBytes16String } from "./utils";
import { BigNumber } from "ethers";

chai.use(solidity);
let owner: SignerWithAddress;
let oddsLib: OddsLib;
let oddsPrecision: number;

// New odds = Odds - ( Odds * Wager / (Pool + Wager)))
const linearTestData = [
	{
		wager: 100,
		odds: 10,
		pool: 2000,
		expectedNewOdds: 5.23
	},
	{
		wager: 100,
		odds: 20,
		pool: 2000,
		expectedNewOdds: 1
	},
	{
		wager: 100,
		odds: 10,
		pool: 500,
		expectedNewOdds: 1
	},
	{
		wager: 100,
		odds: 3,
		pool: 2000,
		expectedNewOdds: 2.57
	}
];

// New payout = (liquidity + wager) - (liquidity / Sqrt(2 * odds * wager / liquidity + 1))
// New odds = new payout / wager;
const curvedTestData = [
	{
		wager: 100,
		odds: 10,
		pool: 2000,
		expectedNewOdds: 6.86
	},
	{
		wager: 200,
		odds: 10,
		pool: 2000,
		expectedNewOdds: 5.23
	},
	{
		wager: 10000,
		odds: 20,
		pool: 2000,
		expectedNewOdds: 1.18
	}
];

describe("Odds", () => {
	beforeEach(async () => {
		[owner] = await ethers.getSigners();
		const fixture = await deployments.fixture(["market"]);
		oddsLib = (await ethers.getContractAt(
			fixture.OddsLib.abi,
			fixture.OddsLib.address
		)) as OddsLib;
	});
	describe("Linear", () => {
		for (const test of linearTestData) {
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Pool: ${test.pool} -> New Odds: ${test.expectedNewOdds}`, async () => {
				const wager = ethers.utils.parseUnits(test.wager.toString(), 6);
				const odds = ethers.utils.parseUnits(test.odds.toString(), 6);
				const pool = ethers.utils.parseUnits(test.pool.toString(), 6);
				const adjustedOdds = await oddsLib.getLinearAdjustedOdds(
					wager,
					odds,
					pool
				);

				const roundedOdds = Math.floor(adjustedOdds.toNumber() / 1000) / 1000;
				expect(roundedOdds).to.be.closeTo(test.expectedNewOdds, 0.01);

				const adjustedOddsNumber = adjustedOdds.toNumber() / 1000000;
				expect(adjustedOddsNumber * test.wager).to.be.lt(
					test.pool + test.wager
				);
			});
		}
	});
	describe("Curved", () => {
		for (const test of curvedTestData) {
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Pool: ${test.pool} -> New Odds: ${test.expectedNewOdds}`, async () => {
				const wager = ethers.utils.parseUnits(test.wager.toString(), 18);
				const odds = ethers.utils.parseUnits(test.odds.toString(), 6);
				const pool = ethers.utils.parseUnits(test.pool.toString(), 18);
				const adjustedOdds = await oddsLib.getCurvedAdjustedOdds(
					wager,
					odds,
					pool
				);
				const roundedOdds = Math.floor(adjustedOdds.toNumber() / 1000) / 1000; // (Math.floor(adjustedOdds.div("1000").toNumber())/1000);
				expect(roundedOdds).to.be.closeTo(test.expectedNewOdds, 0.01);
				const adjustedOddsNumber = adjustedOdds.toNumber() / 1000000;
				expect(adjustedOddsNumber * test.wager).to.be.lt(
					test.pool + test.wager
				);
			});
		}
	});
});
