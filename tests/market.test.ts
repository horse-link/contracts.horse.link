import hre, { ethers, deployments } from "hardhat";
import { BigNumber, BigNumberish, BytesLike, ethers as tsEthers } from "ethers";
import chai, { expect } from "chai";
import {
	Market,
	MarketOracle,
	Market__factory,
	Token,
	Vault,
	Vault__factory
} from "../build/typechain";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { formatBytes16String } from "./utils";

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

describe("Market", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let carol: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const FEE = 100;

	beforeEach(async () => {
		[owner, alice, bob, carol] = await ethers.getSigners();
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
		vault = (await ethers.getContractAt(
			fixture.UsdtVault.abi,
			fixture.UsdtVault.address
		)) as Vault;
		market = (await ethers.getContractAt(
			fixture.UsdtMarket.abi,
			fixture.UsdtMarket.address
		)) as Market;
		oracle = (await ethers.getContractAt(
			fixture.MarketOracle.abi,
			fixture.MarketOracle.address
		)) as MarketOracle;

		tokenDecimals = await underlying.decimals();

		await underlying.mint(
			owner.address,
			ethers.utils.parseUnits("1000000", USDT_DECIMALS)
		);
		await underlying.transfer(
			alice.address,
			ethers.utils.parseUnits("2000000", USDT_DECIMALS)
		);
		await underlying.transfer(
			bob.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);
		await underlying.transfer(
			carol.address,
			ethers.utils.parseUnits("1000", USDT_DECIMALS)
		);

		vault = await new Vault__factory(owner).deploy(underlying.address);
		await vault.deployed();

		const Lib = await ethers.getContractFactory("SignatureLib");
		const lib = await Lib.deploy();
		await lib.deployed();

		const marketFactory = await ethers.getContractFactory("Market", {
			signer: owner,
			libraries: {
				SignatureLib: lib.address
			}
		});

		// https://www.npmjs.com/package/hardhat-deploy?activeTab=readme#handling-contract-using-libraries
		// https://stackoverflow.com/questions/71389974/how-can-i-link-library-and-contract-in-one-file
		const args = [vault.address, FEE, oracle.address];
		market = (await marketFactory.deploy(...args)) as Market;

		await vault.setMarket(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(carol)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(carol)
			.approve(market.address, ethers.constants.MaxUint256);

		// Should get 0 odds if vault has ZERO assets
		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const propositionId = formatBytes16String("1");
		expect(await market.getOdds(wager, odds, propositionId)).to.equal(0);
		// Should get 0 potential payout if vault has Zero odds
		expect(
			await market.getPotentialPayout(propositionId, wager, odds)
		).to.equal(0);

		await vault
			.connect(alice)
			.deposit(ethers.utils.parseUnits("1000", tokenDecimals), alice.address);
	});

	it("should have properties set on deploy", async () => {
		const fee = await market.getFee();
		expect(fee, "fee should be set").to.equal(FEE);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay, "Should have $0 in play").to.equal(0);

		const totalExposure = await market.getTotalExposure();
		expect(totalExposure, "Should have $0 exposure").to.equal(0);

		const vaultAddress = await market.getVaultAddress();
		expect(vaultAddress, "Should have vault address").to.equal(vault.address);

		expect(await market.getOracleAddress()).to.equal(oracle.address);
		expect(await vault.getMarketAllowance()).to.equal(1000000000);
	});

	it("Should get correct odds on a 5:1 punt", async () => {
		const balance = await underlying.balanceOf(bob.address);
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
		await underlying
			.connect(bob)
			.approve(market.address, ethers.utils.parseUnits("50", tokenDecimals));

		const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

		// Runner 1 for a Win
		const propositionId = formatBytes16String("1");

		const trueOdds = await market.getOdds(
			ethers.utils.parseUnits("50", USDT_DECIMALS),
			targetOdds,
			propositionId
		);

		expect(
			trueOdds,
			"Should have true odds of 1:4.75 on $50 in a $1,000 pool"
		).to.equal(4750000);

		const potentialPayout = await market.getPotentialPayout(
			propositionId,
			ethers.utils.parseUnits("50", USDT_DECIMALS),
			targetOdds
		);

		// should equal 237500000
		expect(potentialPayout).to.equal(
			237500000,
			"Should have true odds of 1:4.75 on $100 in a $1,000 pool"
		);
	});

	it("Should not allow back with invalid signature", async () => {
		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000000;

		// Runner 1 for a Win
		const propositionId = formatBytes16String("1");
		const nonce = formatBytes16String("1");

		const marketId = formatBytes16String(MARKET_ID);
		const betSignature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			alice // alice should not sign
		);

		await expect(
			market
				.connect(bob)
				.back(
					nonce,
					propositionId,
					marketId,
					wager,
					odds,
					close,
					end,
					betSignature
				)
		).to.be.revertedWith("back: Invalid signature");
	});

	it("Should allow Bob a $100 punt at 5:1", async () => {
		let balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);

		const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000;

		// check vault balance
		let vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT in vault"
		);

		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT total assets"
		);

		await underlying
			.connect(bob)
			.approve(market.address, ethers.utils.parseUnits("100", tokenDecimals));
		// Runner 1 for a Win
		//AAAAAABBBCC
		const propositionId = formatBytes16String("019450ABC0101W");
		const nonce = formatBytes16String("1");

		// Arbitary market ID set by the operator
		const marketId = formatBytes16String(MARKET_ID);

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
			.back(nonce, propositionId, marketId, wager, odds, close, end, signature);

		expect(await market.getMarketTotal(marketId)).to.equal(
			ethers.utils.parseUnits("100", USDT_DECIMALS)
		);

		balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("900", USDT_DECIMALS),
			"Should have $900 USDT after a $100 bet"
		);

		const inPlay = await market.getTotalInPlay();
		expect(inPlay).to.equal(
			ethers.utils.parseUnits("100", USDT_DECIMALS),
			"Market should be $450 USDT in play after $100 bet @ 1:4.5"
		);

		vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ethers.utils.parseUnits("650", USDT_DECIMALS),
			"Vault should have $650 USDT"
		);

		// Should get expiry after back bet
		const expiry = await market.getExpiry(0);
		expect(expiry).to.equal(end + 2592000, "Should have expiry set");

		const tokenOwner = await market.ownerOf(0);
		expect(tokenOwner, "Bob should have a bet NFT").to.equal(bob.address);
	});

	it("Should allow Carol a $200 punt at 2:1", async () => {
		let balance = await underlying.balanceOf(bob.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT"
		);

		const wager = ethers.utils.parseUnits("200", USDT_DECIMALS);

		const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
		const close = 0;
		const end = 1000000000000;

		// check vault balance
		const vaultBalance = await underlying.balanceOf(vault.address);
		expect(vaultBalance).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT in vault"
		);

		const totalAssets = await vault.totalAssets();
		expect(totalAssets).to.equal(
			ethers.utils.parseUnits("1000", USDT_DECIMALS),
			"Should have $1,000 USDT total assets"
		);

		await underlying
			.connect(carol)
			.approve(market.address, ethers.utils.parseUnits("200", tokenDecimals));
		// Runner 2 for a Win
		const propositionId = formatBytes16String("2");
		const nonce = formatBytes16String("2");

		// Arbitary market ID set by the operator
		const marketId = formatBytes16String(MARKET_ID);
		const betSignature = await signBackMessage(
			nonce,
			marketId,
			propositionId,
			odds,
			close,
			end,
			owner
		);

		await market
			.connect(carol)
			.back(
				nonce,
				propositionId,
				marketId,
				wager,
				odds,
				close,
				end,
				betSignature
			);

		balance = await underlying.balanceOf(carol.address);
		expect(balance).to.equal(
			ethers.utils.parseUnits("800", USDT_DECIMALS),
			"Should have $800 USDT after a $200 bet"
		);
	});

	describe("Settle", () => {
		it("Should transfer to vault if result not been set", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const close = 0;
			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 1 for a Win
			const propositionId = formatBytes16String("1");
			const nonce = formatBytes16String("1");

			// Arbitary market ID set by the operator `${today}_${track}_${race}_W${runner}`
			const marketId = formatBytes16String(MARKET_ID);
			const betSignature = await signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);
			expect(
				await market
					.connect(bob)
					.back(
						nonce,
						propositionId,
						marketId,
						wager,
						odds,
						close,
						end,
						betSignature
					)
			).to.emit(market, "Placed");

			const vaultBalanceBefore = await underlying.balanceOf(vault.address);
			const index = 0;
			await expect(market.settle(index)).to.be.revertedWith(
				"_settle: Payout date not reached"
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});
			expect(await market.settle(index)).to.emit(market, "Settled");

			const vaultBalanceAfter = await underlying.balanceOf(vault.address);

			const bet = await market.getBetByIndex(0);
			expect(vaultBalanceAfter).to.equal(vaultBalanceBefore.add(bet[1]));
		});

		it("Should settle bobs winning bet by index", async () => {
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
			const close = 0;

			const latestBlockNumber = await ethers.provider.getBlockNumber();
			const latestBlock = await ethers.provider.getBlock(latestBlockNumber);

			const end = latestBlock.timestamp + 10000;

			// Runner 1 for a Win
			const propositionId = formatBytes16String("1");
			const nonce = formatBytes16String("1");

			// Arbitary market ID set by the operator `${today}_${track}_${race}_W${runner}`
			const marketId = formatBytes16String(MARKET_ID);
			const betSignature = await signBackMessage(
				nonce,
				marketId,
				propositionId,
				odds,
				close,
				end,
				owner
			);

			let count = await market.getCount();
			expect(count, "There should be no bets").to.equal(0);

			expect(
				await market
					.connect(bob)
					.back(
						nonce,
						propositionId,
						marketId,
						wager,
						odds,
						close,
						end,
						betSignature
					)
			).to.emit(market, "Placed");

			count = await market.getCount();
			expect(count).to.equal(1, "There should be 1 bet");

			const bet = await market.getBetByIndex(0);
			expect(bet[0], "Bet amount should be same as wager").to.equal(wager);

			const inPlayCount = await market.getInPlayCount();
			expect(inPlayCount, "In play count should be 1").to.equal(1);

			let exposure = await market.getTotalExposure();
			expect(exposure).to.equal(ethers.utils.parseUnits("350", USDT_DECIMALS));

			let inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(ethers.utils.parseUnits("100", USDT_DECIMALS));

			const nftBalance = await market.balanceOf(bob.address);
			expect(nftBalance).to.equal(1, "Bob should have 1 NFT");
			await oracle.setResult(
				marketId,
				propositionId,
				"0x0000000000000000000000000000000000000000000000000000000000000000"
			);
			const index = 0;
			await expect(market.settle(index)).to.be.revertedWith(
				"_settle: Payout date not reached"
			);

			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});
			expect(await market.settle(index)).to.emit(market, "Settled");

			const newNftBalance = await market.balanceOf(bob.address);
			expect(newNftBalance).to.equal(0, "Bob should have no NFTs now");

			await expect(market.settle(index)).to.be.revertedWith(
				"settle: Bet has already settled"
			);
			exposure = await market.getTotalExposure();
			expect(exposure).to.equal(0);

			inPlay = await market.getTotalInPlay();
			expect(inPlay).to.equal(0);

			const balance = await underlying.balanceOf(bob.address);
			expect(balance).to.equal(ethers.utils.parseUnits("1350", tokenDecimals));
		});
	});

	describe("ACL", () => {
		it("should not be a valid signer", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			const isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(false);
		});

		it("should allow a new signer to be granted by owner", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await market.connect(owner).grantSigner(newSigner.address);
			const isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(true);
		});

		it("should not allow alice to grant a new signer", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await expect(
				market.connect(alice).grantSigner(newSigner.address)
			).to.be.revertedWith("Ownable: caller is not the owner");
		});

		it("should allow a new signer to be revoked by owner", async () => {
			const newSigner = await ethers.Wallet.createRandom();
			await market.connect(owner).grantSigner(newSigner.address);
			let isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(true);

			await market.connect(owner).revokeSigner(newSigner.address);
			isSigner = await market.isSigner(newSigner.address);
			expect(isSigner).to.equal(false);
		});
	});
});

async function signMessageAsString(message: string, signer: SignerWithAddress) {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	return sig;
}

async function signMessage(message: string, signer: SignerWithAddress) {
	const sig = await signer.signMessage(ethers.utils.arrayify(message));
	const { v, r, s } = ethers.utils.splitSignature(sig);
	return { v, r, s };
}

function makeSetResultMessage(
	marketId: BytesLike,
	propositionId: BytesLike
): string {
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16"],
		[marketId, propositionId]
	);
	return message;
}

async function signSetResultMessage(
	marketId: BytesLike,
	propositionId: BytesLike,
	signer: SignerWithAddress
): Promise<Signature> {
	const settleMessage = makeSetResultMessage(marketId, propositionId);
	return await signMessage(settleMessage, signer);
}

async function signSetResultMessageAsString(
	marketId: BytesLike,
	propositionId: BytesLike,
	signer: SignerWithAddress
): Promise<string> {
	const settleMessage = makeSetResultMessage(marketId, propositionId);
	return await signMessageAsString(settleMessage, signer);
}

async function signBackMessage(
	nonce: string,
	marketId: string,
	propositionId: string,
	odds: BigNumber,
	close: number,
	end: number,
	signer: SignerWithAddress
): Promise<Signature> {
	const message = ethers.utils.solidityKeccak256(
		["bytes16", "bytes16", "bytes16", "uint256", "uint256", "uint256"],
		[nonce, propositionId, marketId, odds, close, end]
	);
	return await signMessage(message, signer);
}
