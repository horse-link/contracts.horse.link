import { ethers } from "hardhat";
import { BigNumber, BigNumberish, ethers as tsEthers, Signer } from "ethers";

import chai, { expect } from "chai";

import {
    Token,
    Market,
    Market__factory,
    Token__factory,
    Vault,
    Vault__factory
} from "../build/typechain";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

describe("Market", () => {
    let underlying: Token;
    let vault: Vault;
    let market: Market;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let carol: SignerWithAddress;
    const USDT_DECIMALS = 6;
    const ODDS_DECIMALS = 6;
    const FEE = 100;

    beforeEach(async () => {

        [owner, alice, bob, carol] = await ethers.getSigners();
        underlying = await new Token__factory(owner).deploy(
            "Mock USDT",
            "USDT",
            USDT_DECIMALS
        );
        await underlying.deployed();
        await underlying.mint(owner.address, ethers.utils.parseUnits("1000000", USDT_DECIMALS));
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
            ethers.constants.AddressZero
        );
        await vault.setMarket(market.address, ethers.constants.MaxUint256);
        await (underlying.connect(alice).approve(
            vault.address,
            ethers.utils.parseUnits("1000", USDT_DECIMALS),
        ));

        await (vault.connect(alice)).deposit(ethers.utils.parseUnits("1000", USDT_DECIMALS), alice.address);
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
        let balance = await underlying.balanceOf(bob.address);
        expect(balance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT");

        // check vault balance
        let vaultBalance = await underlying.balanceOf(vault.address);
        expect(vaultBalance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT in vault");

        const totalAssets = await vault.totalAssets();
        expect(totalAssets).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT total assets");

        await (underlying.connect(bob)).approve(
            market.address,
            ethers.utils.parseUnits("50", USDT_DECIMALS)
        );

        const targetOdds = ethers.utils.parseUnits("5", ODDS_DECIMALS);

        // Runner 1 for a Win
        const propositionId = ethers.utils.formatBytes32String("1");

        const trueOdds = await market.getOdds(
            ethers.utils.parseUnits("50", USDT_DECIMALS),
            targetOdds,
            propositionId
        );

        expect(trueOdds).to.equal(4750000, "Should have true odds of 1:4.75 on $50 in a $1,000 pool");

        const potentialPayout = await market.getPotentialPayout(
            propositionId,
            ethers.utils.parseUnits("50", USDT_DECIMALS),
            targetOdds
        );

        // should equal 237500000
        expect(potentialPayout).to.equal(237500000, "Should have true odds of 1:4.75 on $100 in a $1,000 pool");
    });

    it("should allow Bob a $100 punt at 5:1", async () => {
        let balance = await underlying.balanceOf(bob.address);
        expect(balance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT");


        const wager = ethers.utils.parseUnits("100", USDT_DECIMALS);

        const odds = ethers.utils.parseUnits("5", ODDS_DECIMALS);
        const close = 0;
        const end = 1000000000000;

        // check vault balance
        let vaultBalance = await underlying.balanceOf(vault.address);
        expect(vaultBalance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT in vault");

        const totalAssets = await vault.totalAssets();
        expect(totalAssets).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT total assets");

        await (underlying.connect(bob)).approve(
            market.address,
            ethers.utils.parseUnits("100", USDT_DECIMALS)
        );
        // Runner 1 for a Win
        const propositionId = ethers.utils.formatBytes32String("1");
        const nonce = ethers.utils.formatBytes32String("1");

        // Arbitary market ID set by the operator
        const marketId = ethers.utils.formatBytes32String("20220115-BNE-R1-w");

        const payload = `${nonce}${propositionId}${marketId}${wager}${odds}${close}${end}`;
        const signature = await owner.signMessage(payload);
        console.log(signature);

        await market.connect(bob).back(
            nonce,
            propositionId,
            marketId,
            wager,
            odds,
            close,
            end,
            signature
        );

        balance = await underlying.balanceOf(bob.address);
        expect(balance).to.equal(ethers.utils.parseUnits("900", USDT_DECIMALS), "Should have $900 USDT after a $100 bet");

        const inPlay = await market.getTotalInPlay();
        expect(inPlay).to.equal(ethers.utils.parseUnits("450", USDT_DECIMALS), "Market should be $450 USDT in play after $100 bet @ 1:4.5");

        vaultBalance = await underlying.balanceOf(vault.address);
        expect(vaultBalance).to.equal(ethers.utils.parseUnits("650", USDT_DECIMALS), "Vault should have $650 USDT");
    });

    /*it("should allow Carol a $200 punt at 2:1", async () => {
        let balance = await underlying.balanceOf(bob.address);
        expect(balance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT");

        const wager = ethers.utils.parseUnits("200", USDT_DECIMALS);

        const odds = ethers.utils.parseUnits("2", ODDS_DECIMALS);
        const close = 0;
        const end = 1000000000000;

        // check vault balance
        let vaultBalance = await underlying.balanceOf(vault.address);
        expect(vaultBalance).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT in vault");

        const totalAssets = await vault.totalAssets();
        expect(totalAssets).to.equal(ethers.utils.parseUnits("1000", USDT_DECIMALS), "Should have $1,000 USDT total assets");

        await (underlying.connect(carol)).approve(
            market.address,
            ethers.utils.parseUnits("200", USDT_DECIMALS)
        );
        // Runner 2 for a Win
        const propositionId = ethers.utils.formatBytes32String("2");
        const nonce = ethers.utils.formatBytes32String("2");
        const currentTotalAssets = await vault.totalAssets();
        const expectedMarketOdds = getMarketOdds(wager, odds, currentTotalAssets);
        const marketOdds = await market.getOdds(wager, odds, propositionId);
        expect(marketOdds).to.equal(expectedMarketOdds, "Should have expected market odds");

        // Arbitary market ID set by the operator
        const marketId = ethers.utils.formatBytes32String("20220115-BNE-R1-w");

        const payload = `${nonce}${propositionId}${marketId}${wager}${odds}${close}${end}`;
        const signature = await owner.signMessage(payload);
        console.log(signature);

        await market.connect(carol).back(
            nonce,
            propositionId,
            marketId,
            wager,
            odds,
            close,
            end,
            signature
        );

        balance = await underlying.balanceOf(carol.address);
        expect(balance).to.equal(ethers.utils.parseUnits("800", USDT_DECIMALS), "Should have $800 USDT after a $200 bet");

    });*/
});


function getMarketOdds(wager: BigNumber, odds: BigNumber, totalAssets: BigNumber) {
    const PRECISION = 1000;
    return odds.sub(odds.mul(wager.mul(PRECISION).div(totalAssets)).div(PRECISION));

    //return odds - (odds * (wager * PRECISION / p) / PRECISION);
}
