import hre, { ethers, deployments } from "hardhat";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
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
	formatBytes16String,
	makeMarketId,
	makePropositionId,
	signBackMessage,
	signSetResultMessage
} from "./utils";
import { formatUnits } from "ethers/lib/utils";

type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

// MarketId 11 chars
// AAAAAABBBCC
// A = date as days since epoch
// B = location code
// C = race number
const MARKET_ID = "019123BNE01";

chai.use(solidity);

describe.only("Greedy Market", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let carol: SignerWithAddress;
	let marketSigner: SignerWithAddress;
	let oracleSigner: SignerWithAddress;
	const marketId1 = makeMarketId(new Date(), "ABC", "1");
	const marketId2 = makeMarketId(new Date(), "DEF", "2");

	const close = 0;
	const end = 1000000000000;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;

	before(async () => {
		[owner, alice, bob, carol] = await ethers.getSigners();
		marketSigner = alice;
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

		const SignatureLib = await ethers.getContractFactory("SignatureLib");
		const signatureLib = await SignatureLib.deploy();
		await signatureLib.deployed();

		const marketFactory = await ethers.getContractFactory(
			"MarketGreedyWithoutProtection",
			{
				signer: owner,
				libraries: {
					SignatureLib: signatureLib.address
				}
			}
		);

		// https://www.npmjs.com/package/hardhat-deploy?activeTab=readme#handling-contract-using-libraries
		// https://stackoverflow.com/questions/71389974/how-can-i-link-library-and-contract-in-one-file
		const args = [vault.address, MARGIN, oracle.address];
		market = (await marketFactory.deploy(...args)) as Market;

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

	it("Should get cover from the vault for a new bet", async () => {
		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000;
		const propositionId = makePropositionId(marketId1, 1);

		let vaultBalance = await underlying.balanceOf(vault.address);

		await underlying
			.connect(bob)
			.approve(market.address, ethers.utils.parseUnits("100", tokenDecimals));

		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId1,
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
				formatBytes16String(marketId1),
				wager,
				odds,
				close,
				end,
				signature
			);

		expect(
			await market.getMarketTotalWagers(formatBytes16String(marketId1))
		).to.equal(ethers.utils.parseUnits("100", USDT_DECIMALS));

		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(ethers.utils.parseUnits("100", tokenDecimals));

		vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance, "Vault should have covered $400 of the bet").to.equal(
			BigNumber.from(ethers.utils.parseUnits("999600", tokenDecimals))
		);

		const tokenOwner = await market.ownerOf(0);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Should not get any new cover for a lesser bet on a different proposition in the same market", async () => {
		const betAmountNumber = 50;
		const oddsNumber = 4;
		const wager = ethers.utils.parseUnits(
			betAmountNumber.toString(),
			tokenDecimals
		);
		const odds = ethers.utils.parseUnits(oddsNumber.toString(), ODDS_DECIMALS);
		const propositionId = makePropositionId(marketId1, 2);

		const originalVaultBalance = await underlying.balanceOf(vault.address);
		const originalTotalWagers = await market.getMarketTotalWagers(
			formatBytes16String(marketId1)
		);
		const originalInPlay = await market.getTotalInPlay();

		await underlying.connect(bob).approve(market.address, wager);

		const nonce = "1";

		const signature = await signBackMessage(
			nonce,
			marketId1,
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
				formatBytes16String(marketId1),
				wager,
				odds,
				close,
				end,
				signature
			);

		const newTotalWagers = await market.getMarketTotalWagers(
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

	it("Should get cover for a new bet on a different market", async () => {
		const betAmountNumber = 100;
		const oddsNumber = 5;
		const wager = ethers.utils.parseUnits(
			betAmountNumber.toString(),
			tokenDecimals
		);
		const odds = ethers.utils.parseUnits(oddsNumber.toString(), ODDS_DECIMALS);
		const propositionId = makePropositionId(marketId2, 1);
		const potentialWinnings = ethers.utils.parseUnits("400", ODDS_DECIMALS);
		const winningsTokens = ethers.utils.formatUnits(
			potentialWinnings,
			tokenDecimals
		);

		const originalVaultBalance = await underlying.balanceOf(vault.address);
		const originalTotalWagers = await market.getMarketTotalWagers(
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

		const newTotalWagers = await market.getMarketTotalWagers(
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
		const differenceInTokens = originalVaultBalance.sub(newVaultBalance);
		expect(
			differenceInTokens,
			`Vault should have covered ${winningsTokens} of the bet but instead covered $${differenceInTokens}`
		).to.equal(potentialWinnings);
		//expect(vaultBalance.sub(newVaultBalance), "Vault should have covered $400 of the bet").to.equal(
		//	BigNumber.from(ethers.utils.parseUnits("400", tokenDecimals)),
		//);

		const tokenOwner = await market.ownerOf(2);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it.skip("Should settle the first bet", async () => {
		const propositionId = makePropositionId(marketId1, 1);
		await hre.network.provider.request({
			method: "evm_setNextBlockTimestamp",
			params: [end + 7200]
		});

		const oracleOwner = await oracle.getOwner();
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

		await market.connect(alice).settle(0);

		await market.connect(owner).settle(0);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(ethers.utils.parseUnits("140", tokenDecimals));
	});
});
