import { ethers } from "hardhat";
import { ethers as tsEthers } from "ethers";
import { expect } from "chai";
import { isAddress } from "ethers/lib/utils";
import { NFT, NFT__factory } from "../build/typechain";

let token: NFT;
let deployer: tsEthers.Signer;
let user: tsEthers.Wallet;

describe("ERC721 Token", () => {
  before(async () => {
    deployer = (await ethers.getSigners())[0];
    user = new ethers.Wallet(
      "0xbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeefbeef",
      deployer.provider
    );
    token = await new NFT__factory(deployer).deploy(
      "ERC721Token",
      "NFT",
      100,
      user.address,
      "https://www.cooltokens.com/"
    );
    // Send ETH to user from signer.
    await deployer.sendTransaction({
      to: user.address,
      value: ethers.utils.parseEther("1000")
    });
  });

  it("Should have sale not active when contract is deployed", async () => {
    //Check contract has deployed
    const address = token.address;
    const verifyAddress = isAddress(address);
    expect(verifyAddress === true);

    //Check sale active status
    expect((await token.isMintEnabled()) === false);
  });

  it("Should return sale active status", async () => {
    await token.toggleMintStatus();
    expect((await token.isMintEnabled()) === true);
  });

  it("Should only allow owner to toggle if sale is active", async () => {
    await expect(token.connect(user).toggleMintStatus()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should only mint NFTs if the sale is active", async () => {
    await token.toggleMintStatus();
    await expect(token.mint(5, user.address)).to.be.revertedWith(
      "Minting is not enabled"
    );
  });

  it("Should only allow owner to mint a pass", async () => {
    await token.toggleMintStatus();
    await expect(token.connect(user).mint(5, user.address)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });

  it("Should mint tokens", async () => {
    token.connect(deployer);
    await token.mint(5, user.address);
    const balance = await token.balanceOf(user.address);
    expect(balance).to.equal(5);

    //Check token ID
    const currentTokenId = await token.getLastTokenId();
    expect(currentTokenId === ethers.utils.parseEther("5"));
  });

  it("Should set token URI", async () => {
    const currentTokenId = await token.getLastTokenId();
    const currentTokenUri = await token.tokenURI(currentTokenId);
    const baseUri = await token.getBaseURI();
    const fullUri = baseUri + "/" + currentTokenId + ".json";
    expect(currentTokenUri === fullUri);

    //Check non-existant token URI returns error
    const unmintedTokenId = currentTokenId.add(1);
    await expect(token.tokenURI(unmintedTokenId)).to.be.revertedWith(
      "Nonexistent token"
    );
  });

  it("Should not mint more than max number of passes", async () => {
    //Already minted 5, max is 100, need to mint 95 more
    await token.mint(95, user.address);
    await expect(token.mint(1, user.address)).to.be.revertedWith(
      "Not enough tokens remaining to mint"
    );
  });

  it("Should set the base URI", async () => {
    await token.setBaseURI("https://newbaseuri.com");
    const newBaseUri = await token.getBaseURI();
    expect(newBaseUri === "https://newbaseuri.com");
  });

  it("Should only allow owner to call renounceOwnership and new owner always be the fixed address ", async () => {
    await expect(token.connect(user).renounceOwnership()).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );

    await token.renounceOwnership();
    const newOwner = await token.owner();
    expect(newOwner).to.equal(user.address); //this the fixed new owner address

    await expect(
      token.connect(deployer).renounceOwnership()
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });
});
