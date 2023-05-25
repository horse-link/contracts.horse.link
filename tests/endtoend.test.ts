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

describe("End to End", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let market_owner: SignerWithAddress;
	let whale: SignerWithAddress;
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
		[owner, alice, bob, market_owner] = await ethers.getSigners();
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
			ethers.utils.parseUnits("2000000000", USDT_DECIMALS) // $2k
		);
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("2000000000", USDT_DECIMALS) // $2k
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
		market = (await marketFactory.connect(owner).deploy(...args)) as Market;
		await market.deployed();

		expect(await market.owner()).to.eq(owner.address);

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000);
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

		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
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
	});

	it.only("Should do end to end test", async () => {
		// Deposit 1000 USDT from alice
		const FIFTY = ethers.utils.parseUnits("50", USDT_DECIMALS);
		const ONE_HUNDRED = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const TWO_HUNDRED = ethers.utils.parseUnits("200", USDT_DECIMALS);
		const FOUR_HUNDRED = ethers.utils.parseUnits("400", USDT_DECIMALS);
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
		let inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(0, "Should have $0 USDT in play");

		let inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(0, "Should have 0 bets in play");

		let exposure = await market.getTotalExposure();
		expect(exposure).to.equal(0, "Should have $0 USDT exposure");

		// Place a $100 bet from bettor 1 on proposition / horse 1
		const currentTime = await time.latest();
		const close = currentTime + 3600;
		const end = 1000000000000;

		const marketId = makeMarketId(new Date(), "ABC", "1");

		const propositionId_1 = makePropositionId(marketId, 1);
		const nonce_1 = "1";

		const signature_1 = await signBackMessage(
			nonce_1,
			marketId,
			propositionId_1,
			ethers.utils.parseUnits("5", ODDS_DECIMALS), // odds,
			close,
			end,
			owner
		);

		await market.connect(bob).back(
			constructBet(
				formatBytes16String(nonce_1),
				formatBytes16String(propositionId_1),
				formatBytes16String(marketId),
				ONE_HUNDRED, // wager
				ethers.utils.parseUnits("5", ODDS_DECIMALS), // odds,
				close,
				end,
				signature_1
			)
		);

		// $100 market total
		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			ONE_HUNDRED
		);

		inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(ONE_HUNDRED, "Should have $100 USDT in play");

		inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(1, "Should have 1 bets in play");

		exposure = await market.getTotalExposure();
		expect(exposure).to.equal(FOUR_HUNDRED, "Should have $400 USDT exposure");

		// Place a $50 bet from bettor 2 on proposition / horse 2
		const propositionId_2 = makePropositionId(marketId, 1);
		const nonce_2 = "2";

		const signature_2 = await signBackMessage(
			nonce_2,
			marketId,
			propositionId_2,
			ethers.utils.parseUnits("2", ODDS_DECIMALS), // odds,
			close,
			end,
			owner
		);

		await market.connect(bob).back(
			constructBet(
				formatBytes16String(nonce_2),
				formatBytes16String(propositionId_2),
				formatBytes16String(marketId),
				ONE_HUNDRED, // wager
				ethers.utils.parseUnits("2", ODDS_DECIMALS), // odds,
				close,
				end,
				signature_2
			)
		);

		// $200 market total
		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			TWO_HUNDRED
		);

		inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(2, "Should have 2 bets in play");

		// exposure = await market.getTotalExposure();
		// expect(exposure).to.equal(FOUR_HUNDRED, "Should have $400 USDT exposure");

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

		// Settle the market
		await market.settleMarket(formatBytes16String(marketId));

		inPlayCount = await market.getInPlayCount();
		expect(inPlayCount).to.equal(0);

		// Check the vault balance

		// Check market owner balance
		const marketOwnerBalance = await underlying.balanceOf(market_owner.address);
	});
});
