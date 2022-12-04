import { ethers, deployments } from "hardhat";
import chai, { expect } from "chai";
import { OddsLib } from "../build/typechain";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);
let owner: SignerWithAddress;
let oddsLib: OddsLib;

// Expected new odds = Odds - (Odds * Wager / Vault)
const linearTestData = [
	{
		wager: 100,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 5
	},
	{
		wager: 100,
		odds: 20,
		vault: 2000,
		expectedNewOdds: 0
	},
	{
		wager: 100,
		odds: 10,
		vault: 500,
		expectedNewOdds: 0
	},
	{
		wager: 100,
		odds: 3,
		vault: 2000,
		expectedNewOdds: 2.55
	}
];

const curvedTestData = [
	{
		wager: 100,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 5.86
	},
	{
		wager: 200,
		odds: 10,
		vault: 2000,
		expectedNewOdds: 4.23
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
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Pool: ${test.vault} -> New Odds: ${test.expectedNewOdds}`, async () => {
				const wager = ethers.utils.parseUnits(test.wager.toString(), 6);
				const odds = ethers.utils.parseUnits(test.odds.toString(), 6);
				const vault = ethers.utils.parseUnits(test.vault.toString(), 6);
				const adjustedOdds = await oddsLib.getLinearAdjustedOdds(
					wager,
					odds,
					vault
				);

				expect(adjustedOdds).to.equal(
					ethers.utils.parseUnits(test.expectedNewOdds.toString(), 6)
				);
				const adjustedOddsNumber = adjustedOdds.toNumber() / 1000000;
				expect(adjustedOddsNumber * test.wager).to.be.lt(test.vault);
			});
		}
	});
	describe("Curved", () => {
		for (const test of curvedTestData) {
			it(`Wager: ${test.wager}, Odds: ${test.odds}, Pool: ${test.vault} -> New Odds: ${test.expectedNewOdds}`, async () => {
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
				expect(adjustedOddsNumber * test.wager).to.be.lt(test.vault);
			});
		}
	});
});
