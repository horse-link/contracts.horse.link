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
import {
	constructBet,
	makeMarketId,
	makePropositionId,
	signBackMessage,
	signSetResultMessage,
	signSetScratchedMessage
} from "./utils";
import { formatBytes16String } from "../scripts/utils";

chai.use(solidity);

describe.only("Market simulation", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;
	const TIMEOUT_DAYS = 5;
	const WINNER = 0x01;
	const LOSER = 0x02;
	const SCRATCHED = 0x03;
	const NFT_BASE_URI = "https://example.org/";

	before(async () => {
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
		vault = (await ethers.getContractAt(
			fixture.MockUsdtVault.abi,
			fixture.MockUsdtVault.address
		)) as Vault;
		market = (await ethers.getContractAt(
			fixture.MockUsdtMarket.abi,
			fixture.MockUsdtMarket.address
		)) as Market;
		oracle = (await ethers.getContractAt(
			fixture.MarketOracle.abi,
			fixture.MarketOracle.address
		)) as MarketOracle;

		tokenDecimals = await underlying.decimals();

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
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
		const args = [
			vault.address,
			MARGIN,
			TIMEOUT_DAYS,
			oracle.address,
			NFT_BASE_URI
		];
		market = (await marketFactory.deploy(...args)) as Market;

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000);

		await underlying
			.connect(owner)
			.approve(vault.address, ethers.constants.MaxUint256);

		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);

		// Should get 0 odds if vault has ZERO assets
		// const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		// const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		// const propositionId = formatBytes16String("1");
		// const marketId = formatBytes16String("1");

		// expect(await market.getOdds(wager, odds, propositionId, marketId)).to.equal(
		// 	1
		// );
		// // Should get potential payout = wager if vault has no assets
		// expect(
		// 	await market.getPotentialPayout(propositionId, marketId, wager, odds)
		// ).to.equal(wager);

		await vault
			.connect(owner)
			.deposit(ethers.utils.parseUnits("1000", tokenDecimals), owner.address);
	});

	it("Should do simulation", async () => {
		// Alice the punte
		const balance = await underlying.balanceOf(alice.address);
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

		// await underlying
		// 	.connect(bob)
		// 	.approve(market.address, ethers.utils.parseUnits("50", tokenDecimals));

		const marketId = makeMarketId(new Date(), "ABC", "1");
		const propositionId = makePropositionId(marketId, 2);

		const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

		const expectedOdds = await market.getOdds(
			ethers.utils.parseUnits("10", USDT_DECIMALS),
			targetOdds,
			formatBytes16String(propositionId),
			formatBytes16String(marketId)
		);

		expect(
			expectedOdds,
			"Should have true odds of 4.95 on $10 in a $1,000 pool"
		).to.be.closeTo(BigNumber.from(495000), 1);

		// // Runner 1 for a Win
		// const propositionId = formatBytes16String("1");
		// const marketId = formatBytes16String("1");

		// // there still needs to be slippage in the odds
		// const trueOdds = await market.getOdds(
		// 	ethers.utils.parseUnits("50", USDT_DECIMALS),
		// 	targetOdds,
		// 	propositionId,
		// 	marketId
		// );

		// expect(
		// 	trueOdds,
		// 	"Should have true odds of 3.809524 on $50 in a $1,000 pool"
		// ).to.be.closeTo(BigNumber.from(3809524), 1);

		// const potentialPayout = await market.getPotentialPayout(
		// 	propositionId,
		// 	marketId,
		// 	ethers.utils.parseUnits("50", USDT_DECIMALS),
		// 	targetOdds
		// );

		// expect(potentialPayout, "Payout should be 190476190").to.be.closeTo(
		// 	BigNumber.from(190476190),
		// 	10
		// );
	});
});
