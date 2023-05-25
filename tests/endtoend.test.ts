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
	signSetResultMessage
} from "./utils";
import { formatBytes16String } from "../scripts/utils";

chai.use(solidity);

describe("End to End", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let carol: SignerWithAddress;
	let dean: SignerWithAddress;
	let market_owner: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const DAI_DECIMALS = 18;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;
	const TIMEOUT_DAYS = 5;
	const WINNER = 0x01;
	const SCRATCHED = 0x03;
	const NFT_BASE_URI = "https://example.org/";

	beforeEach(async () => {
		[owner, alice, bob, carol, dean, market_owner] = await ethers.getSigners();
		oracleSigner = owner;
		const fixture = await deployments.fixture([
			"underlying",
			"registry",
			"vault",
			"market",
			"oracle"
		]);

		// Deploy oracle
		oracle = (await ethers.getContractAt(
			fixture.MarketOracle.abi,
			fixture.MarketOracle.address
		)) as MarketOracle;

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

		tokenDecimals = await underlying.decimals();

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("100000000000000", USDT_DECIMALS)
		);

		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000000000", USDT_DECIMALS)
		);

		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("2000000000", USDT_DECIMALS)
		);

		await underlying.transfer(
			carol.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS) // $1k
		);

		await underlying.transfer(
			dean.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS) // $1k
		);

		// await underlying.transfer(
		// 	carol.address,
		// 	ethers.utils.parseUnits("1000", USDT_DECIMALS)
		// );
		// await underlying.transfer(
		// 	whale.address,
		// 	ethers.utils.parseUnits("10000000", USDT_DECIMALS)
		// );

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const OddsLib = await ethers.getContractFactory("MockOddsLib");
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
		market = (await marketFactory
			.connect(market_owner)
			.deploy(...args)) as Market;
		await market.deployed();

		expect(await market.owner()).to.eq(market_owner.address);

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000); // 1.07x or 7% fee

		// Approve vault to spend USDT for investors
		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(vault.address, ethers.constants.MaxUint256);

		// await underlying
		// 	.connect(carol)
		// 	.approve(vault.address, ethers.constants.MaxUint256);
		// await underlying
		// 	.connect(whale)
		// 	.approve(vault.address, ethers.constants.MaxUint256);

		// Approve market to spend USDT for punters
		await underlying
			.connect(carol)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(dean)
			.approve(market.address, ethers.constants.MaxUint256);

		// await underlying
		// 	.connect(carol)
		// 	.approve(market.address, ethers.constants.MaxUint256);
		// await underlying
		// 	.connect(whale)
		// 	.approve(market.address, ethers.constants.MaxUint256);

		// // Should get 0 odds if vault has ZERO assets
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

		const carolBalance = await underlying.balanceOf(carol.address);
		expect(carolBalance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);
	});

	const checkMarketTotals = async (
		expectedInPlay: BigNumber,
		expectedInPlayCount: number,
		expectedExposure: BigNumber
	) => {
		// Markets should be empty
		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(expectedInPlay);

		const inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(expectedInPlayCount);

		const exposure = await market.getTotalExposure();
		expect(exposure).to.equal(expectedExposure);
	};

	it.only("Should do end to end test", async () => {
		let marketOwnerBalance = await underlying.balanceOf(owner.address);
		console.log("marketOwnerBalance", marketOwnerBalance.toString());

		// Deposit 1000 USDT from alice
		const ZERO = BigNumber.from(0);
		const FIFTY = ethers.utils.parseUnits("50", USDT_DECIMALS);
		const ONE_HUNDRED = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const TWO_HUNDRED = ethers.utils.parseUnits("200", USDT_DECIMALS);
		const FOUR_HUNDRED = ethers.utils.parseUnits("400", USDT_DECIMALS);
		const FIVE_HUNDRED = ethers.utils.parseUnits("500", USDT_DECIMALS);
		const ONE_THOUSAND = ethers.utils.parseUnits("1000", USDT_DECIMALS);
		const TEN_THOUSAND = ethers.utils.parseUnits("10000", USDT_DECIMALS);

		await vault.connect(alice).deposit(ONE_THOUSAND, alice.address);

		// Deposit 50 USDT from bob
		await vault.connect(bob).deposit(FIFTY, bob.address);

		// Withdraw 50 shares from alice
		await vault.connect(alice).withdraw(FIFTY, alice.address, alice.address);

		// check vault balance
		const vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ONE_THOUSAND,
			"Should have $1,000 USDT in vault"
		);

		await vault.connect(alice).deposit(TEN_THOUSAND, alice.address);

		// Markets should be empty
		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(0, "Should have $0 USDT in play");

		const inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(0, "Should have 0 bets in play");

		const exposure = await market.getTotalExposure();
		expect(exposure).to.equal(0, "Should have $0 USDT exposure");

		// Place a $100 bet from bettor 1 on proposition / horse 1
		const currentTime = await time.latest();
		const close = currentTime + 3600;
		const end = 1000000000000;

		const marketId = makeMarketId(new Date(), "ABC", "1");

		// ###################
		// # Place bet 1
		// ###################
		const propositionId_1 = makePropositionId(marketId, 1);
		const nonce_0 = "0";

		const signature_0 = await signBackMessage(
			nonce_0,
			marketId,
			propositionId_1,
			ethers.utils.parseUnits("5", ODDS_DECIMALS), // odds,
			close,
			end,
			market_owner
		);

		await market.connect(carol).back(
			constructBet(
				formatBytes16String(nonce_0),
				formatBytes16String(propositionId_1),
				formatBytes16String(marketId),
				ONE_HUNDRED, // wager
				ethers.utils.parseUnits("5", ODDS_DECIMALS), // odds,
				close,
				end,
				signature_0
			)
		);

		const bet_0 = await market.getBetByIndex(0);
		const betAmount = bet_0[0];
		const betPayout = bet_0[1];

		expect(betAmount).to.equal(ONE_HUNDRED, "Should have $100 USDT bet");
		expect(betPayout).to.equal(FIVE_HUNDRED, "Should have $500 USDT payout");

		let carolBalance = await underlying.balanceOf(carol.address);
		expect(carolBalance).to.equal(
			ethers.utils.parseUnits("900", USDT_DECIMALS)
		);

		let marketBalance = await underlying.balanceOf(market.address);
		expect(marketBalance).to.equal(FIVE_HUNDRED);

		// $100 market total
		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			ONE_HUNDRED
		);

		// inPlay = await market.getTotalInPlay();
		// expect(inPlay).to.equal(ONE_HUNDRED, "Should have $100 USDT in play");

		// inPlayCount = await market.getInPlayCount();
		// expect(inPlayCount).to.equal(1, "Should have 1 bets in play");

		// exposure = await market.getTotalExposure();
		// expect(exposure).to.equal(FOUR_HUNDRED, "Should have $400 USDT exposure");

		// inplay, inplayCount, exposure
		await checkMarketTotals(ONE_HUNDRED, 1, FOUR_HUNDRED);

		// ###################
		// # Place bet 2
		// ###################
		// Place a $50 bet from bettor 2 on proposition / horse 2
		const propositionId_2 = makePropositionId(marketId, 1);
		const nonce_1 = "1";

		const signature_1 = await signBackMessage(
			nonce_1,
			marketId,
			propositionId_2,
			ethers.utils.parseUnits("2", ODDS_DECIMALS), // odds,
			close,
			end,
			market_owner
		);

		await market.connect(dean).back(
			constructBet(
				formatBytes16String(nonce_1),
				formatBytes16String(propositionId_2),
				formatBytes16String(marketId),
				ONE_HUNDRED, // wager
				ethers.utils.parseUnits("2", ODDS_DECIMALS), // odds,
				close,
				end,
				signature_1
			)
		);

		// $200 market total
		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			TWO_HUNDRED
		);

		// inPlayCount = await market.getInPlayCount();
		// expect(inPlayCount).to.equal(2, "Should have 2 bets in play");

		// exposure = await market.getTotalExposure();
		// expect(exposure).to.equal(FIVE_HUNDRED, "Should have $500 USDT exposure");

		// inplay, inplayCount, exposure
		await checkMarketTotals(TWO_HUNDRED, 2, FIVE_HUNDRED);

		// Close the market
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [end + 7200]
		});

		// Set the result to be proposition 1
		const result_signature = await signSetResultMessage(
			marketId,
			propositionId_1,
			oracleSigner
		);

		await oracle.setResult(
			formatBytes16String(marketId),
			formatBytes16String(propositionId_1),
			result_signature
		);

		// // Settle the market
		// await market.settleMarket(formatBytes16String(marketId));

		// Settle the winner, no one else gets paid
		await market.settle(0); // WIN

		// inplay, inplayCount, exposure
		await checkMarketTotals(ONE_HUNDRED, 1, ONE_HUNDRED);

		// inPlayCount = await market.getInPlayCount();
		// expect(inPlayCount).to.equal(1);

		marketOwnerBalance = await underlying.balanceOf(market_owner.address);
		expect(marketOwnerBalance).to.equal(
			0,
			"Should have $0 USDT in market owner account"
		);

		carolBalance = await underlying.balanceOf(carol.address);
		expect(carolBalance).to.equal(
			ethers.utils.parseUnits("1400", USDT_DECIMALS)
		);

		marketBalance = await underlying.balanceOf(market.address);
		expect(marketBalance).to.equal(TWO_HUNDRED);

		// Settle winning bet, bet index 1
		await market.settle(1);

		// inplay, inplayCount, exposure
		await checkMarketTotals(ZERO, 0, ZERO);

		marketBalance = await underlying.balanceOf(market.address);
		expect(marketBalance).to.equal(0);

		// vaultBalance = await underlying.balanceOf(vault.address);
		// expect(vaultBalance).to.equal(0);

		// Check the vault balance

		// Check market owner balance
		// Should have the profits form the loosing bet less the 7% interest
		// marketOwnerBalance = await underlying.balanceOf(market_owner.address);
		// expect(marketOwnerBalance).to.equal(
		// 	ethers.utils.parseUnits("93", USDT_DECIMALS),
		// 	"Should have $93 USDT in market owner account"
		// );
	});
});
