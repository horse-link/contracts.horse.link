import hre, { ethers, deployments } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
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
import { constructBet, signBackMessage, signSetResultMessage } from "./utils";
import { bytes16HexToString } from "../scripts/utils";
import { formatting, markets } from "horselink-sdk";

chai.use(solidity);

describe("Market Oracle", () => {
	let underlying: Token;
	let tokenDecimals: number;
	let vault: Vault;
	let market: Market;
	let oracle: MarketOracle;
	let owner: SignerWithAddress;
	let alice: SignerWithAddress;
	let bob: SignerWithAddress;
	let oracleSigner: SignerWithAddress;

	const USDT_DECIMALS = 6;
	const ODDS_DECIMALS = 6;
	const MARGIN = 100;
	const TIMEOUT_DAYS = 5;

	beforeEach(async () => {
		[owner, alice, bob] = await ethers.getSigners();
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
			"https://example.org/"
		];
		market = (await marketFactory.deploy(...args)) as Market;

		await vault.setMarket(market.address, ethers.constants.MaxUint256, 107000); // 7% interest rate
		await underlying
			.connect(alice)
			.approve(vault.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(vault.address, ethers.constants.MaxUint256);

		await underlying
			.connect(alice)
			.approve(market.address, ethers.constants.MaxUint256);
		await underlying
			.connect(bob)
			.approve(market.address, ethers.constants.MaxUint256);

		await vault
			.connect(alice)
			.deposit(ethers.utils.parseUnits("1000", tokenDecimals), alice.address);
	});

	describe("Adding oracle results", () => {
		it("should get owner address", async () => {
			const ownerAddress = await oracle.getOwner();
			expect(ownerAddress).to.equal(owner.address);
		});

		it("should add set and get proposition to oracle", async () => {
			const marketId = "20240101RED1W";
			const propositionId = markets.makePropositionId(marketId, 1);

			const signature = await signSetResultMessage(
				marketId,
				propositionId,
				oracleSigner
			);

			await oracle.setResult(
				formatting.formatBytes16String(marketId),
				formatting.formatBytes16String(propositionId),
				signature
			);

			const actual = await oracle.getResult(
				formatting.formatBytes16String(marketId)
			);
			expect(bytes16HexToString(actual.winningPropositionId)).to.equal(
				propositionId
			);
		});

		it("should not settle market if proposition is not set", async () => {
			const marketId = "20240101ABC1W";
			const propositionId1 = markets.makePropositionId(marketId, 1);
			const propositionId2 = markets.makePropositionId(marketId, 2);

			const nonce = "1";
			const currentTime = await time.latest();
			// Assume race closes in 1 hour from now
			const close = currentTime + 3600;
			const end = 1000000000000;

			// Bet on proposition 1 (loser)
			const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
			const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

			const signature1 = await signBackMessage(
				nonce,
				marketId,
				propositionId1,
				odds,
				close,
				end,
				owner
			);

			await market
				.connect(bob)
				.back(
					constructBet(
						formatBytes16String(nonce),
						formatBytes16String(propositionId1),
						formatBytes16String(marketId),
						wager,
						odds,
						close,
						end,
						signature1
					)
				);

			const signature2 = await signBackMessage(
				nonce,
				marketId,
				propositionId2,
				odds,
				close,
				end,
				owner
			);

			// Bet on proposition 2 (winner)
			await market
				.connect(bob)
				.back(
					constructBet(
						formatBytes16String(nonce),
						formatBytes16String(propositionId2),
						formatBytes16String(marketId),
						wager,
						odds,
						close,
						end,
						signature2
					)
				);

			// Fast forward
			await hre.network.provider.request({
				method: "evm_setNextBlockTimestamp",
				params: [end + 7200]
			});

			// NOTE:  THIS SHOULD THROW AN ERROR
			// Settle proposition 2 as winner
			await expect(market.settle(1)).to.be.revertedWith(
				"_settle: Oracle does not have a result"
			); // 1 the index of proposition 2

			// Add proposition 2 to oracle as winner
			const signature = await signSetResultMessage(
				marketId,
				propositionId2,
				oracleSigner
			);

			await oracle.setResult(
				formatBytes16String(marketId),
				formatBytes16String(propositionId2),
				signature
			);

			// Settle proposition 2
			await market.settle(1);

			// Settle proposition 1
			await market.settle(0);

			const count = await market.getInPlayCount();
			expect(count).to.equal(0);
		});
	});
});
