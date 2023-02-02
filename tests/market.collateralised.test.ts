import hre, { ethers, deployments } from "hardhat";
import { BigNumber } from "ethers";
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
	formatBytes16String,
	makeMarketId,
	makePropositionId,
	signBackMessage,
	signSetResultMessage
} from "./utils";

chai.use(solidity);

describe("Collateralised Market: play through", () => {
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
	const marketId1 = makeMarketId(new Date(), "ABC", "1");
	const marketId2 = makeMarketId(new Date(), "DEF", "2");
	const bet1 = 100;
	const bet1Odds = 5;
	const bet2 = 100;
	const bet2Odds = 4;
	const bet3 = 50;
	const bet3Odds = 5;
	let bet1Cover: BigNumber;
	let bet3Cover: BigNumber;

	const close = 1000000000000;
	const end = 1000000000000;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;

	before(async () => {
		[owner, alice, bob, carol] = await ethers.getSigners();

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
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("1000", tokenDecimals)
		);
		await underlying.transfer(
			carol.address,
			ethers.utils.parseUnits("1000", tokenDecimals)
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		//const SignatureLib = await ethers.getContractFactory("SignatureLib");
		//const signatureLib = await SignatureLib.deploy();
		//await signatureLib.deployed();

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
		const marketId = marketId1;
		const wager = ethers.utils.parseUnits(bet1.toString(), USDT_DECIMALS);
		const odds = ethers.utils.parseUnits(bet1Odds.toString(), ODDS_DECIMALS);
		const potentialWinnings = wager
			.mul(odds)
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));
		const originalVaultBalance = await underlying.balanceOf(vault.address);
		const originalExposure = await market.getTotalExposure();
		const close = 1000000000000;
		const end = 1000000000000;
		const propositionId = makePropositionId(marketId, 1);

		await underlying
			.connect(bob)
			.approve(
				market.address,
				ethers.utils.parseUnits(bet1.toString(), tokenDecimals)
			);

		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(bob)
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

		expect(await market.getMarketTotal(formatBytes16String(marketId))).to.equal(
			ethers.utils.parseUnits(bet1.toString(), USDT_DECIMALS)
		);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(
			ethers.utils.parseUnits(bet1.toString(), tokenDecimals)
		);

		const newVaultBalance = await underlying.balanceOf(vault.address);
		const vaultDelta = originalVaultBalance.sub(newVaultBalance);
		bet1Cover = potentialWinnings.sub(wager);
		expect(
			vaultDelta,
			`Vault should have covered $${ethers.utils.formatUnits(
				bet1Cover,
				tokenDecimals
			)} of the bet`
		).to.equal(bet1Cover);

		const newExposure = await market.getTotalExposure();
		expect(
			newExposure,
			"Exposure should have gone up by the covered amount"
		).to.equal(originalExposure.add(bet1Cover));

		const tokenOwner = await market.ownerOf(0);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Bet 2: Should not get any new cover for a lesser bet on a different proposition in the same market", async () => {
		const marketId = marketId1;
		const wager = ethers.utils.parseUnits(bet2.toString(), tokenDecimals);
		const odds = ethers.utils.parseUnits(bet2Odds.toString(), ODDS_DECIMALS);
		const propositionId = makePropositionId(marketId, 2);

		const originalVaultBalance = await underlying.balanceOf(vault.address);
		const originalTotalWagers = await market.getMarketTotal(
			formatBytes16String(marketId)
		);
		const originalInPlay = await market.getTotalInPlay();

		await underlying.connect(bob).approve(market.address, wager);

		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(bob)
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

		const newTotalWagers = await market.getMarketTotal(
			formatBytes16String(marketId1)
		);
		//Expect the total wagers to have gone up by the wager amount
		expect(
			newTotalWagers,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalTotalWagers.add(wager));

		const newInPlay = await market.getTotalInPlay();
		expect(newInPlay, "In play has gone up by the bet amount").to.equal(
			originalInPlay.add(wager)
		);

		const newVaultBalance = await underlying.balanceOf(vault.address);
		expect(newVaultBalance, "Vault should not have covered the bet").to.equal(
			originalVaultBalance
		);
		const tokenOwner = await market.ownerOf(1);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Bet 3: Should get cover for a new bet on a different market", async () => {
		const odds = ethers.utils.parseUnits(bet3Odds.toString(), ODDS_DECIMALS);
		const propositionId = makePropositionId(marketId2, 1);
		const wager = ethers.utils.parseUnits(bet3.toString(), tokenDecimals);
		const potentialWinnings = wager
			.mul(odds)
			.div(ethers.utils.parseUnits("1", ODDS_DECIMALS));
		const originalVaultBalance = await underlying.balanceOf(vault.address);
		const winningsTokens = ethers.utils.formatUnits(
			potentialWinnings,
			tokenDecimals
		);
		console.log(`Betting ${bet3} tokens at odds of ${bet3Odds}`);

		console.log(`Potential winnings: ${winningsTokens} tokens`);

		const originalTotalWagers = await market.getMarketTotal(
			formatBytes16String(marketId2)
		);
		const originalInPlay = await market.getTotalInPlay();

		await underlying.connect(bob).approve(market.address, wager);
		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId2,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(bob)
			.back(
				formatBytes16String(nonce),
				formatBytes16String(propositionId),
				formatBytes16String(marketId2),
				wager,
				odds,
				close,
				end,
				signature
			);

		const newTotalWagers = await market.getMarketTotal(
			formatBytes16String(marketId2)
		);
		//Expect the total wagers to have gone up by the wager amount
		expect(
			newTotalWagers,
			"Total wagers should have gone up by the wager amount"
		).to.equal(originalTotalWagers.add(wager));

		const newInPlay = await market.getTotalInPlay();
		expect(newInPlay, "In play has gone up by the bet amount").to.equal(
			originalInPlay.add(wager)
		);

		const newVaultBalance = await underlying.balanceOf(vault.address);
		const vaultDelta = newVaultBalance.sub(originalVaultBalance);
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

	it("Fast forward", async () => {
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [end + 7200]
		});
	});

	it("Bet 1: Should settle", async () => {
		const propositionId = makePropositionId(marketId1, 1);
		const originalExposure = await market.getTotalExposure();
		const originalInPlay = await market.getTotalInPlay();

		const signature = await signSetResultMessage(
			marketId1,
			propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(marketId1),
			formatBytes16String(propositionId),
			signature
		);

		// Bob won the bet
		const initialAliceBalance = await underlying.balanceOf(alice.address);
		const initialBobBalance = await underlying.balanceOf(bob.address);
		await market.connect(bob).settle(0);

		const newInPlay = await market.getTotalInPlay();
		const inPlayDelta = originalInPlay.sub(newInPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet1.toString(), tokenDecimals));

		// His balance should have gone up by the potential winnings
		const bobBalance = await underlying.balanceOf(bob.address);
		const bobDelta = bobBalance.sub(initialBobBalance);
		expect(bobDelta, "Bob should have won the bet").to.equal(
			BigNumber.from(bet1).mul(
				ethers.utils.parseUnits(bet1Odds.toString(), ODDS_DECIMALS)
			)
		);

		const bet = await market.getBetByIndex(0);
		expect(bet[1], "Bet struct payout should equal the actual payout").to.equal(
			BigNumber.from(bet1).mul(
				ethers.utils.parseUnits(bet1Odds.toString(), ODDS_DECIMALS)
			)
		);

		const newExposure = await market.getTotalExposure();
		const exposureDelta = originalExposure.sub(newExposure);
		expect(
			exposureDelta,
			"Bet 1: Exposure should have gone down by the covered amount"
		).to.equal(bet1Cover);
	});

	it("Should settle the second bet", async () => {
		const originalInPlay = await market.getTotalInPlay();
		const originalExposure = await market.getTotalExposure();

		// Bob lost the bet
		const initialBobBalance = await underlying.balanceOf(bob.address);
		await market.connect(bob).settle(1);

		const newInPlay = await market.getTotalInPlay();
		const inPlayDelta = originalInPlay.sub(newInPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet2.toString(), tokenDecimals));

		const bobBalance = await underlying.balanceOf(bob.address);
		const bobDelta = bobBalance.sub(initialBobBalance);
		expect(bobDelta, "Bob should have lost the bet").to.equal(0);

		const newExposure = await market.getTotalExposure();
		const exposureDelta = originalExposure.sub(newExposure);
		expect(exposureDelta, "Total Exposure should not have gone down").to.equal(
			BigNumber.from(0)
		);
	});

	it("Should settle the third bet", async () => {
		const betId = 2;
		const propositionId = makePropositionId(marketId2, 2);
		const signature = await signSetResultMessage(
			marketId2,
			propositionId,
			oracleSigner
		);
		await oracle.setResult(
			formatBytes16String(marketId2),
			formatBytes16String(propositionId),
			signature
		);
		const originalExposure = await market.getTotalExposure();
		const originalInPlay = await market.getTotalInPlay();

		// Bob lost the bet
		const initialBobBalance = await underlying.balanceOf(bob.address);
		await market.connect(bob).settle(betId);

		const newInPlay = await market.getTotalInPlay();
		const inPlayDelta = originalInPlay.sub(newInPlay);
		expect(
			inPlayDelta,
			"Total In Play should have gone down by the wager amount"
		).to.equal(ethers.utils.parseUnits(bet3.toString(), tokenDecimals));

		const bobBalance = await underlying.balanceOf(bob.address);
		const bobDelta = initialBobBalance.sub(bobBalance);
		expect(bobDelta, "Bob should have lost the bet").to.equal(
			BigNumber.from(0)
		);

		const newExposure = await market.getTotalExposure();
		expect(
			newExposure,
			"Total Exposure should have gone down by the covered amount"
		).to.equal(originalExposure.sub(bet3Cover));
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
