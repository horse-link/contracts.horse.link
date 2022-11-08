import { ethers } from "hardhat";

import chai, { expect } from "chai";

import {
  Token,
  Market__factory,
  Token__factory,
  Registry,
  Registry__factory,
  Vault__factory
} from "../build/typechain";

import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

chai.use(solidity);

describe("Registry", () => {
  let underlying: Token;
  let token: Token;

  let registry: Registry;
  let owner: SignerWithAddress;
  let nonTokenHolders: SignerWithAddress;

  beforeEach(async () => {
    [owner, nonTokenHolders] = await ethers.getSigners();
    underlying = await new Token__factory(owner).deploy(
      "Mock USDT",
      "USDT",
      18
    );
    await underlying.deployed();

    token = await new Token__factory(owner).deploy("HL", "HL", 18);
    await token.deployed();

    registry = await new Registry__factory(owner).deploy(token.address);
    await registry.deployed();
  });

  it("Should only allow owner to set threshold", async () => {
    await expect(
      registry.connect(nonTokenHolders).setThreshold(100)
    ).to.be.revertedWith("onlyOwner: Caller is not the contract owner");
  });

  it("Should not allow under threshold holders to add vaults and market", async () => {
    const vault = await new Vault__factory(owner).deploy(underlying.address);
    const market = await new Market__factory(owner).deploy(
      vault.address,
      1,
      ethers.constants.AddressZero
    );
    const thresholdAmount = ethers.BigNumber.from("1000");
    await registry.setThreshold(thresholdAmount);

    await expect(
      registry.connect(nonTokenHolders).addVault(vault.address)
    ).to.be.revertedWith(
      "onlyTokenHolders: Caller does not hold enough tokens"
    );

    await expect(
      registry.connect(nonTokenHolders).addMarket(market.address)
    ).to.be.revertedWith(
      "onlyTokenHolders: Caller does not hold enough tokens"
    );
  });

  it("should be able to add markets and vaults", async () => {
    const market_count = await registry.marketCount();
    expect(market_count).to.equal(0, "Should have no markets");

    const vault_count = await registry.vaultCount();
    expect(vault_count).to.equal(0, "Should have no vaults");

    const vault = await new Vault__factory(owner).deploy(underlying.address);
    const market = await new Market__factory(owner).deploy(
      vault.address,
      1,
      ethers.constants.AddressZero
    );

    await registry.addMarket(market.address);
    const market_count2 = await registry.marketCount();
    expect(market_count2).to.equal(1, "Should have 1 market");

    await expect(registry.addMarket(market.address)).to.be.revertedWith(
      "addMarket: Market already added"
    );

    await registry.addVault(vault.address);
    const vault_count2 = await registry.vaultCount();
    expect(vault_count2).to.equal(1, "Should have 1 vault");
  });
});
