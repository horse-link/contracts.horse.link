import { BigNumber, BigNumberish, BytesLike } from "ethers";
import chai, { expect } from "chai";
import { ethers, deployments } from "hardhat";
import { solidity } from "ethereum-waffle";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { Market, MarketOracle, Registry, Token, Vault } from "../build/typechain";

chai.use(solidity);

describe("Registry", () => {
  let underlying: Token;
  let token: Token;
  let vault: Vault;
  let registry: Registry;
  let market: Market;
  let oracle: MarketOracle;

  let owner: SignerWithAddress;

  beforeEach(async () => {
    const fixture = await deployments.fixture([
      "registry",
      "vault",
      "market"
    ]);
    [owner] = await ethers.getSigners();

    token = await ethers.getContract("Token", owner);
    vault = await ethers.getContract("Vault", owner);
    market = await ethers.getContract("Market", owner);
    //registry = await ethers.getContract("Registry", owner);
    oracle = await ethers.getContract("MarketOracle", owner);
    

  });

  it("should be able to add markets and vaults", async () => {
    //Deploy a new market

    const marketDeployment = await deployments.deploy("Market 2", {
      from: owner.address,
      args: [vault.address, 0, oracle.address],
      log: true,
      autoMine: true, 
      skipIfAlreadyDeployed: true
    });


    const market_count = await registry.marketCount();
    expect(market_count).to.equal(0, "Should have no markets");

    const vault_count = await registry.vaultCount();
    expect(vault_count).to.equal(0, "Should have no vaults");

    await registry.addMarket(market.address);
    const market_count2 = await registry.marketCount();
    expect(market_count2).to.equal(1, "Should have 1 market");

    await registry.addVault(vault.address);
    const vault_count2 = await registry.vaultCount();
    expect(vault_count2).to.equal(1, "Should have 1 vault");
  });
});
