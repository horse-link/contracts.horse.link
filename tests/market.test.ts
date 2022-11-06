import { ethers } from "hardhat";
import { BigNumber, BigNumberish, ethers as tsEthers, Signer } from "ethers";

import chai, { expect } from "chai";

import {
  Market,
  Market__factory,
  MarketOracle,
  MarketOracle__factory,
  Token,
  Token__factory,
  Vault,
  Vault__factory,
  Oracle__factory
} from "../build/typechain";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

type Signature = {
  v: BigNumberish;
  r: string;
  s: string;
};

chai.use(solidity);

describe("Market", () => {
  let underlying: Token;
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

    oracle = await new MarketOracle__factory(owner).deploy();
    await oracle.deployed();

    underlying = await new Token__factory(owner).deploy(
      "Mock USDT",
      "USDT",
      USDT_DECIMALS
    );
    await underlying.deployed();
    await underlying.mint(
      owner.address,
      ethers.utils.parseUnits("1000000", USDT_DECIMALS)
    );
    await underlying.transfer(
      alice.address,
      ethers.utils.parseUnits("2000", USDT_DECIMALS)
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
    market = await new Market__factory(owner).deploy(
      vault.address,
      FEE,
      oracle.address
    );
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

    await vault
      .connect(alice)
      .deposit(ethers.utils.parseUnits("1000", USDT_DECIMALS), alice.address);
  });

  it("should properties set on deploy", async () => {
    const fee = await market.getFee();
    expect(fee).to.equal(FEE, "fee should be set");

    const inPlay = await market.getTotalInPlay();
    expect(inPlay).to.equal(0, "Should have $0 in play");

    const totalExposure = await market.getTotalExposure();
    expect(totalExposure).to.equal(0, "Should have no exposure");

    const vault = await market.getVaultAddress();
    expect(vault).to.equal(vault, "Should have vault address");
  });

  it("should get correct odds on a 5:1 punt", async () => {
    const balance = await underlying.balanceOf(bob.address);
    expect(balance).to.equal(
      ethers.utils.parseUnits("1000", USDT_DECIMALS),
      "Should have $1,000 USDT"
    );

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
      .connect(bob)
      .approve(market.address, ethers.utils.parseUnits("50", USDT_DECIMALS));

    const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

    // Runner 1 for a Win
    const propositionId = ethers.utils.formatBytes32String("1");

    const trueOdds = await market.getOdds(
      ethers.utils.parseUnits("50", USDT_DECIMALS),
      targetOdds,
      propositionId
    );

    expect(trueOdds).to.equal(
      4750000,
      "Should have true odds of 1:4.75 on $50 in a $1,000 pool"
    );

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

  it("should allow Bob a $100 punt at 5:1", async () => {
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
      .approve(market.address, ethers.utils.parseUnits("100", USDT_DECIMALS));
    // Runner 1 for a Win
    const propositionId = ethers.utils.formatBytes32String("1");
    const nonce = ethers.utils.formatBytes32String("1");

    // Arbitary market ID set by the operator
    const marketId = ethers.utils.formatBytes32String("20220115-BNE-R1-w");

    const signature = await signBackMessage(
      nonce,
      propositionId,
      marketId,
      wager,
      odds,
      close,
      end,
      owner
    );

    await market
      .connect(bob)
      .back(nonce, propositionId, marketId, wager, odds, close, end, signature);

    balance = await underlying.balanceOf(bob.address);
    expect(balance).to.equal(
      ethers.utils.parseUnits("900", USDT_DECIMALS),
      "Should have $900 USDT after a $100 bet"
    );

    const inPlay = await market.getTotalInPlay();
    expect(inPlay).to.equal(
      ethers.utils.parseUnits("450", USDT_DECIMALS),
      "Market should be $450 USDT in play after $100 bet @ 1:4.5"
    );

    vaultBalance = await underlying.balanceOf(vault.address);
    expect(vaultBalance).to.equal(
      ethers.utils.parseUnits("650", USDT_DECIMALS),
      "Vault should have $650 USDT"
    );
  });

  it("should allow Carol a $200 punt at 2:1", async () => {
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
      .approve(market.address, ethers.utils.parseUnits("200", USDT_DECIMALS));
    // Runner 2 for a Win
    const propositionId = ethers.utils.formatBytes32String("2");
    const nonce = ethers.utils.formatBytes32String("2");

    // Arbitary market ID set by the operator
    const marketId = ethers.utils.formatBytes32String("20220115-BNE-R1-w");
    const betSignature = await signBackMessage(
      nonce,
      propositionId,
      marketId,
      wager,
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
    it("should settle bobs winning bet by index", async () => {
      const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);
      const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
      const close = 0;
      const end = 1000000000000;

      // Runner 1 for a Win
      const propositionId = ethers.utils.formatBytes32String("1");
      const nonce = ethers.utils.formatBytes32String("1");

      // Arbitary market ID set by the operator `${today}_${track}_${race}_W${runner}`
      const marketId = ethers.utils.formatBytes32String("20220115_BNE_1_W");
      const betSignature = await signBackMessage(
        nonce,
        propositionId,
        marketId,
        wager,
        odds,
        close,
        end,
        owner
      );

      let count = await market.getCount();
      expect(count).to.equal(0, "First bet should have a 0 index");

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
      expect(count).to.equal(1, "Second bet should have a 1 index");

      let exposure = await market.getTotalExposure();

      await oracle.setResult(
        marketId,
        propositionId,
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      );

      // const settleMessage = makeSettleMessage(index, true);
      // const contractSettleMessage = await market.getSettleMessage(index, true);
      // expect(settleMessage).to.equal(
      //   contractSettleMessage,
      //   "Settle message should match"
      // );
      // const settleSignature = await signSettleMessage(index, true, owner);
      // await market.settle(index, true, settleSignature);

      const index = 0;
      expect(await market.settle(index)).to.emit(market, "Settled");

      const inPlay = await market.getTotalInPlay();
      expect(inPlay).to.equal(0);

      // const balance = await underlying.balanceOf(bob.address);
      // expect(balance).to.equal(500);
    });
  });
});

async function signMessage(message: string, signer: SignerWithAddress) {
  const sig = await signer.signMessage(ethers.utils.arrayify(message));
  const { v, r, s } = ethers.utils.splitSignature(sig);
  return { v, r, s };
}

function makeSettleMessage(index: BigNumber, result: boolean): string {
  const settleMessage = ethers.utils.solidityKeccak256(
    ["uint256", "bool"],
    [index, result]
  );
  return settleMessage;
}

function signSettleMessage(
  index: BigNumber,
  result: boolean,
  signer: SignerWithAddress
): Promise<Signature> {
  const settleMessage = makeSettleMessage(index, result);
  return signMessage(settleMessage, signer);
}

function signBackMessage(
  nonce: string,
  propositionId: string,
  marketId: string,
  wager: BigNumber,
  odds: BigNumber,
  close: number,
  end: number,
  signer: SignerWithAddress
) {
  const backMessage = ethers.utils.solidityKeccak256(
    [
      "bytes32",
      "bytes32",
      "bytes32",
      "uint256",
      "uint256",
      "uint256",
      "uint256"
    ],
    [nonce, propositionId, marketId, wager, odds, close, end]
  );
  return signMessage(backMessage, signer);
}
