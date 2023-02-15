import { ethers, deployments } from "hardhat";
import chai, { expect } from "chai";
import { OddsLib } from "../build/typechain";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

chai.use(solidity);
let owner: SignerWithAddress;
let oddsLib: OddsLib;

// New odds = Odds - ( Odds * Wager / (Vault + Wager)))
const linearTestData = [
	{
		wager: 100,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 5.23
	},
	{
		wager: 100,
		odds: 20,
		vault: 2000,
		expectedNewOdds: 1
	},
	{
		wager: 100,
		odds: 10,
		vault: 500,
		expectedNewOdds: 1
	},
	{
		wager: 100,
		odds: 3,
		vault: 2000,
		expectedNewOdds: 2.57
	}
];

// New payout = (liquidity + wager) - (liquidity / Sqrt(2 * odds * wager / liquidity + 1))
// New odds = new payout / wager;
const curvedTestData = [
	{
		wager: 100,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 6.86
	},
	{
		wager: 200,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 5.23
	},
	{
		wager: 10000,
		odds: 20,
		vault: 2000,
		expectedNewOdds: 1.18
	}
];

// These odds have a margin of 1.33
const marginTestData = {
	bookieOdds: [3, 3, 3, 6, 6],
	fairOdds: [4, 4, 4, 8, 8]
};

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
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Vault: ${test.vault} -> New Odds: ${test.expectedNewOdds}`, async () => {
				const wager = ethers.utils.parseUnits(test.wager.toString(), 6);
				const odds = ethers.utils.parseUnits(test.odds.toString(), 6);
				const vault = ethers.utils.parseUnits(test.vault.toString(), 6);
				const adjustedOdds = await oddsLib.getLinearAdjustedOdds(
					wager,
					odds,
					vault
				);

				const roundedOdds = Math.floor(adjustedOdds.toNumber() / 1000) / 1000;
				expect(roundedOdds).to.be.closeTo(test.expectedNewOdds, 0.01);

				const adjustedOddsNumber = adjustedOdds.toNumber() / 1000000;
				expect(adjustedOddsNumber * test.wager).to.be.lt(
					test.vault + test.wager
				);
			});
		}
	});
	describe("Curved", () => {
		for (const test of curvedTestData) {
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Vault: ${test.vault} -> New Odds: ${test.expectedNewOdds}`, async () => {
				const wager = ethers.utils.parseUnits(test.wager.toString(), 18);
				const odds = ethers.utils.parseUnits(test.odds.toString(), 6);
				const vault = ethers.utils.parseUnits(test.vault.toString(), 18);
				const adjustedOdds = await oddsLib.getCurvedAdjustedOdds(
					wager,
					odds,
					vault
				);
				const roundedOdds = Math.floor(adjustedOdds.toNumber() / 1000) / 1000; // (Math.floor(adjustedOdds.div("1000").toNumber())/1000);
				expect(roundedOdds).to.be.closeTo(test.expectedNewOdds, 0.01);
				const adjustedOddsNumber = adjustedOdds.toNumber() / 1000000;
				expect(adjustedOddsNumber * test.wager).to.be.lt(
					test.vault + test.wager
				);
			});
		}
	});

	describe("Margin", () => {
		let bnBookieOdds: BigNumber[];
		let bnFairOdds: BigNumber[];

		before(() => {
			bnBookieOdds = marginTestData.bookieOdds.map((odds) => {
				return ethers.utils.parseUnits(odds.toString(), 6);
			});
			bnFairOdds = marginTestData.fairOdds.map((odds) => {
				return ethers.utils.parseUnits(odds.toString(), 6);
			});
		});

		it(`Margin: 1.33`, async () => {
			const margin = await oddsLib.getMargin(bnBookieOdds);
			const numMargin = Number(ethers.utils.formatUnits(margin, 6));
			expect(numMargin).to.be.closeTo(1.33, 0.01);
		});
		it(`Margin: 1.0`, async () => {
			const margin = await oddsLib.getMargin(bnFairOdds);
			const numMargin = Number(ethers.utils.formatUnits(margin, 6));
			expect(numMargin).to.be.closeTo(1.0, 0.01);
		});
		it(`Remove margin from bookie odds`, async () => {
			const margin = await oddsLib.getMargin(bnBookieOdds);
			const oddsWithoutMargin = [];
			for (const odds of bnBookieOdds) {
				const newOdds = await oddsLib.removeMargin(odds, margin);
				oddsWithoutMargin.push(newOdds);
			}
			const newMargin = await oddsLib.getMargin(oddsWithoutMargin);
			const numNewMargin = Number(ethers.utils.formatUnits(newMargin, 6));
			expect(numNewMargin).to.be.closeTo(1.0, 0.001);
		});
		it(`Add margin to one odd`, async () => {
			const odd = ethers.utils.parseUnits("4", 6);
			const oddsWithMargin = await oddsLib.addMargin(
				odd,
				ethers.utils.parseUnits("1.333333", 6)
			);
			const numOddsWithMargin = Number(
				ethers.utils.formatUnits(oddsWithMargin, 6)
			);
			expect(numOddsWithMargin).to.be.closeTo(3, 0.001);
		});
		it(`Add margin to fair odds`, async () => {
			const bookieMargin = await oddsLib.getMargin(bnBookieOdds);
			const oddsWithMargin = [];
			for (const odds of bnFairOdds) {
				const newOdds = await oddsLib.addMargin(odds, bookieMargin);
				oddsWithMargin.push(newOdds);
			}
			const newMargin = await oddsLib.getMargin(oddsWithMargin);
			const numNewMargin = Number(ethers.utils.formatUnits(newMargin, 6));
			expect(numNewMargin).to.be.closeTo(1.33, 0.01);
		});
		it(`Recalculate odds after a scratch`, async () => {
			// Scratch the last runner
			//const scratchedOdds = bnBookieOdds[bnBookieOdds.length - 1];
			const oddsWithoutScratch = bnBookieOdds.slice(0, bnBookieOdds.length - 1);
			const currentMargin = await oddsLib.getMargin(oddsWithoutScratch);
			const targetMargin = ethers.utils.parseUnits("1.25", 6);
			const newOddsList = [];
			for (const odds of oddsWithoutScratch) {
				const newOdds = await oddsLib.changeMargin(
					odds,
					currentMargin,
					targetMargin
				);
				newOddsList.push(newOdds);
			}
			const newMargin = await oddsLib.getMargin(newOddsList);
			const numNewMargin = Number(ethers.utils.formatUnits(newMargin, 6));
			expect(numNewMargin).to.be.closeTo(1.25, 0.01);
		});

		it(`Recalculate odds after several scratches`, async () => {
			// Scratch the last 3 runners
			const oddsWithoutScratch = bnBookieOdds.slice(0, bnBookieOdds.length - 3);
			const currentMargin = await oddsLib.getMargin(oddsWithoutScratch);
			const targetMargin = ethers.utils.parseUnits("1.25", 6);
			const newOddsList = [];
			for (const odds of oddsWithoutScratch) {
				const newOdds = await oddsLib.changeMargin(
					odds,
					currentMargin,
					targetMargin
				);
				newOddsList.push(newOdds);
			}
			const newMargin = await oddsLib.getMargin(newOddsList);
			const numNewMargin = Number(ethers.utils.formatUnits(newMargin, 6));
			expect(numNewMargin).to.be.closeTo(1.25, 0.01);
		});
	});
});
