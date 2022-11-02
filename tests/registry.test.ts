import { ethers } from "hardhat";
import { BigNumber, BigNumberish, ethers as tsEthers } from "ethers";

import chai, { expect } from "chai";

import {
    Token,
    Market,
    Market__factory,
    Token__factory,
    Vault,
    Registry,
    Registry__factory,
    Vault__factory,
    MockToken__factory,
} from "../build/typechain";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

describe("Registry", () => {
    let underlying: Token;
    let token: Token;
    let vault: Vault;
    
    let registry: Registry;
    let owner: SignerWithAddress;

    beforeEach(async () => {
 
        [owner] = await ethers.getSigners();
        underlying = await new Token__factory(owner).deploy(
            "Mock USDT",
            "USDT",
            18
        );
        await underlying.deployed();

        token = await new Token__factory(owner).deploy(
            "HL",
            "HL",
            18
        );
        await token.deployed();

        registry = await new Registry__factory(owner).deploy(token.address);
        await registry.deployed();

    });

    it("should be able to add markets and vaults", async () => {      
        const market_count = await registry.marketCount();
        expect(market_count).to.equal(0, "Should have no markets");

        const vault_count = await registry.vaultCount();
        expect(vault_count).to.equal(0, "Should have no vaults");

        const vault = await new Vault__factory(owner).deploy(underlying.address);
        const market = await new Market__factory(owner).deploy(vault.address, 1, ethers.constants.AddressZero);
  
        await registry.addMarket(market.address);
        const market_count2 = await registry.marketCount();
        expect(market_count2).to.equal(1, "Should have 1 market");
  
        await registry.addVault(vault.address);
        const vault_count2 = await registry.vaultCount();
        expect(vault_count2).to.equal(1, "Should have 1 vault");
    });
});


