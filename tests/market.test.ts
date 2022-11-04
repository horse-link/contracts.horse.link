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
            ethers.constants.AddressZero
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
        const marketOwner = await market.owner();
        expect(marketOwner).to.equal(owner.address);
        
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
        expect(balance).to.equal(
            ethers.utils.parseUnits("1000", USDT_DECIMALS),
            "Should have $1,000 USDT"
        );

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

        const potentialPayout = await market.getPotentialPayout(
            propositionId,
            wager,
            odds
        );

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
        expect(balance, "Should have $900 USDT after a $100 bet").to.equal(
            ethers.utils.parseUnits("900", USDT_DECIMALS)        
        );

        const inPlay = await market.getTotalInPlay();
        expect(inPlay, "Market should have in play amount equal to payout").to.equal(potentialPayout);

        vaultBalance = await underlying.balanceOf(vault.address);
        expect(vaultBalance, "Vault should have original amount minus the exposure amount").to.equal(
            BigNumber.from(ethers.utils.parseUnits("1000", USDT_DECIMALS)).sub(potentialPayout.sub(wager))
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
        
        await vault
            .connect(alice)
            .deposit(ethers.utils.parseUnits("1000", USDT_DECIMALS), alice.address);
    });

    it("should settle by index", async () => {
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

        let index = await market.getCount();
        expect(index).to.equal(0, "Should have no bets yet");

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
            );
        const bet: any = await market.getBetByIndex(index);
        expect(BigNumber.from(bet[0])).to.equal(BigNumber.from(propositionId));

        const newBetCount = await market.getCount();
        expect(newBetCount).to.equal(1, "Should have 1 bet");

        const settleMessage = makeSettleMessage(index, true);
        const contractSettleMessage = await market.getSettleMessage(index, true);
        expect(settleMessage).to.equal(
            contractSettleMessage,
            "Settle message should match"
        );
        const settleSignature = await signSettleMessage(0, true, owner);
        await market.settle(0, true, settleSignature);
    });
});

async function signMessage(message: string, signer: SignerWithAddress) {
    const sig = await signer.signMessage(ethers.utils.arrayify(message));
    const { v, r, s } = ethers.utils.splitSignature(sig);
    return { v, r, s };
}

function makeSettleMessage(index: BigNumberish, result: boolean): string {
    const settleMessage = ethers.utils.solidityKeccak256(
        ["uint256", "bool"],
        [index, result]
    );
    return settleMessage;
}


function makeBackMessage(
    nonce: string,
    propositionId: string,
    marketId: string,
    wager: BigNumberish,
    odds: BigNumberish,
    close: BigNumberish,
    end: BigNumberish
): string {
    const backMessage = ethers.utils.solidityKeccak256(
        ["bytes32", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256"],
        [nonce, propositionId, marketId, wager, odds, close, end]
    );
    return backMessage;
}

function signSettleMessage(
    index: BigNumberish,
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
    const backMessage = makeBackMessage(nonce, propositionId, marketId, wager, odds, close, end);
    return signMessage(backMessage, signer);
}
