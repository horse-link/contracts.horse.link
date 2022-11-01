import { ethers } from "hardhat";
import { BigNumber, BigNumberish, ethers as tsEthers } from "ethers";

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

describe("Vault", () => {
    let underlying: Token;
    let vault: Vault;
    let market: Market;
    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;

    beforeEach(async () => {
        const USDT_DECIMALS = 6;
        [owner, alice, bob] = await ethers.getSigners();
        underlying = await new Token__factory(owner).deploy(
            "Mock USDT",
            "USDT",
            6
        );
        await underlying.deployed();
        await underlying.mint(owner.address, ethers.utils.parseUnits("1000000", 6));
        await underlying.transfer(
            alice.address,
            ethers.utils.parseUnits("2000", 6)
        );
        await underlying.transfer(bob.address, ethers.utils.parseUnits("2000", 6));

        vault = await new Vault__factory(owner).deploy(underlying.address);
        await vault.deployed();
        market = await new Market__factory(owner).deploy(
            vault.address,
            100,
            ethers.constants.AddressZero
        );
        await vault.setMarket(market.address, ethers.constants.MaxUint256);
    });

    it("Mock USDT has correreturn the correct symbol", async () => {
        expect(await underlying.symbol()).to.equal("USDT");
    });

    it("should set properties on deploy", async () => {
        const fee = await market.getFee();
        expect(fee).to.equal(100, "Should have fee of 100");

        const totalSupply = await vault.totalSupply();
        expect(totalSupply).to.equal(0, "Should have no tokens");

        const vaultPerformance = await vault.getPerformance();
        expect(vaultPerformance).to.equal(0, "Should have no values");

        const _underlying = await vault.asset();
        expect(_underlying).to.equal(
            underlying.address,
            "Should have token address as underlying"
        );

        const _market = await vault.getMarket();
        expect(_market).to.equal(market.address, "Should have market address");

        const name = await vault.name();
        expect(name).to.equal("HL Mock USDT", "Should have name as HL Mock USDT");

        const symbol = await vault.symbol();
        expect(symbol).to.equal("HLUSDT", "Should have symbol as HLUSDT");
    });
});
