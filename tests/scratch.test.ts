import hre, { ethers, deployments } from "hardhat";
import { BigNumber } from "ethers";
import chai, { expect } from "chai";
import {
	MarketCollateralisedWithoutProtection,
	MarketOracle,
	MarketWithoutProtection,
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
	signSetResultMessage,
	signSetScratchedMessage
} from "./utils";

chai.use(solidity);

describe.only("Late scratched", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: MarketCollateralisedWithoutProtection;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;

	let oracleSigner: SignerWithAddress;
	const marketId = makeMarketId(new Date(), "ABC", "1");

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;

	beforeEach(async () => {
		[owner, alice] = await ethers.getSigners();

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

		const args = [vault.address, MARGIN, 1, oracle.address];
		market = (await marketFactory.deploy(
			...args
		)) as MarketCollateralisedWithoutProtection;

		await vault.setMarket(market.address, ethers.constants.MaxUint256);

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

	it("A scratching occurs after a bet has been placed", async () => {
		const betNum = 100; // 100 USDT
		const oddsNum = 2;
		const wager = ethers.utils.parseUnits(betNum.toString(), USDT_DECIMALS);
		const odds = ethers.utils.parseUnits(oddsNum.toString(), ODDS_DECIMALS);
		const close = 1000000000000;
		const end = 1000000000000;
		const propositionId = makePropositionId(marketId, 1);
		const nonce = "1";

		const potentialWinnings = wager
			.mul(odds)
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));

		//=== Place the bet
		const signature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await underlying.connect(alice).approve(market.address, wager);

		await market
			.connect(alice)
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

		const betBeforeScratch = await market.getBetByIndex(0);
		const potentialPayoutBeforeScratch = betBeforeScratch[1];

		expect(
			potentialPayoutBeforeScratch,
			`Payout before scratch should be wager times odds but is $${ethers.utils.formatUnits(
				potentialPayoutBeforeScratch,
				6
			)}`
		).to.equal(potentialWinnings);

		//=== Scratch a runner
		const scratchedPropositionId = makePropositionId(marketId, 2);
		const scratchedOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const scratchedSig = await signSetScratchedMessage(
			marketId,
			scratchedPropositionId,
			scratchedOdds,
			BigNumber.from(0),
			oracleSigner
		);
		await oracle.setScratchedResult(
			formatBytes16String(marketId),
			formatBytes16String(scratchedPropositionId),
			scratchedOdds,
			0,
			scratchedSig
		);

		//=== Set the result to make Alice a winner
		const resultSig = await signSetResultMessage(
			marketId,
			propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(marketId),
			formatBytes16String(propositionId),
			resultSig
		);

		//=== Go forward in time
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [end + 7200]
		});

		//=== Settle Alice's bet
		const aliceOriginalBalance = await underlying.balanceOf(alice.address);
		await market.settle(0);

		//=== Check Alice's balance
		const aliceBalance = await underlying.balanceOf(alice.address);
		const aliceWinnings = aliceBalance.sub(aliceOriginalBalance);
		expect(aliceWinnings).to.be.lt(wager.mul(odds));

		//=== Check winnings on bet
		const betAfterScratch = await market.getBetByIndex(0);
		expect(betAfterScratch[1]).to.be.eq(aliceWinnings);
	});
});
