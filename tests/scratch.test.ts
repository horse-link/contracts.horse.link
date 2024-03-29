import hre, { ethers, deployments } from "hardhat";
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
	makeBet,
	Markets,
	signSetResultMessage,
	signSetScratchedMessage,
	TestBet
} from "./utils";
import { formatting } from "horselink-sdk";

chai.use(solidity);

describe("Late scratched", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: MarketCollateralisedWithoutProtection;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;

	let oracleSigner: SignerWithAddress;
	const testMarket = Markets.BlueDogs;
	const marketId = testMarket.marketId;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;

	beforeEach(async () => {
		[owner, alice] = await ethers.getSigners();

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

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("10000000", tokenDecimals)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000000", tokenDecimals)
		);

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const OddsLib = await ethers.getContractFactory("OddsLib");
		const oddsLib = await OddsLib.deploy();
		await oddsLib.deployed();

		const marketFactory = await ethers.getContractFactory(
			"MarketCollateralisedWithoutProtection",
			{
				signer: owner,
				libraries: {
					SignatureLib: signatureLib.address,
					OddsLib: oddsLib.address
				}
			}
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

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

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000);

		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);

		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);

		await vault
			.connect(alice)
			.deposit(
				ethers.utils.parseUnits("1000000", tokenDecimals),
				alice.address
			);
	});

	it.skip("A scratching occurs after a bet has been placed", async () => {
		const betNum = 100; // 100 USDT
		const oddsNum = 2;

		const potentialWinnings = betNum * oddsNum;

		//=== Place the bet
		const bet: TestBet = {
			market: testMarket,
			runner: Markets.BlueDogs.runners[0],
			amount: betNum,
			odds: oddsNum,
			bettor: alice
		};
		await makeBet(underlying, market, vault, bet, owner);

		const betBeforeScratch = await market.getBetByIndex(0);
		const potentialPayoutBeforeScratch = betBeforeScratch[1];

		expect(
			potentialPayoutBeforeScratch,
			`Payout before scratch should be wager times odds but is $${ethers.utils.formatUnits(
				potentialPayoutBeforeScratch,
				6
			)}`
		).to.equal(ethers.utils.parseUnits(potentialWinnings.toString(), 6));

		//=== Scratch a runner
		const scratchedPropositionId = testMarket.runners[1].propositionId;
		const scratchedOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const scratchedSig = await signSetScratchedMessage(
			marketId,
			scratchedPropositionId,
			scratchedOdds,
			oracleSigner
		);
		expect(
			await oracle.setScratchedResult(
				formatting.formatBytes16String(marketId),
				formatting.formatBytes16String(scratchedPropositionId),
				scratchedOdds,
				scratchedSig
			)
		).to.emit(oracle, "ScratchedResultSet");

		//=== Set the result to make Alice a winner
		const resultSig = await signSetResultMessage(
			marketId,
			bet.runner.propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatting.formatBytes16String(marketId),
			formatting.formatBytes16String(bet.runner.propositionId),
			resultSig
		);

		//=== Go forward in time
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [END + 7200]
		});

		//=== Settle Alice's bet
		const aliceOriginalBalance = await underlying.balanceOf(alice.address);
		await market.settle(0);

		//=== Check Alice's balance
		const wager = ethers.utils.parseUnits(bet.amount.toString(), USDT_DECIMALS);
		const odds = ethers.utils.parseUnits(bet.odds.toString(), ODDS_DECIMALS);
		const aliceBalance = await underlying.balanceOf(alice.address);
		const aliceWinnings = aliceBalance.sub(aliceOriginalBalance);
		expect(aliceWinnings).to.be.lt(wager.mul(odds));

		//=== Check winnings on bet
		const betAfterScratch = await market.getBetByIndex(0);
		expect(betAfterScratch[1]).to.be.eq(aliceWinnings);
	});
});
