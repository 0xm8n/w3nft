import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import * as dotenv from "dotenv";
// eslint-disable-next-line node/no-missing-import
import { W3NFT } from "../typechain";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
dotenv.config();

describe("W3NFT", () => {
  let testSC: W3NFT;
  let ownerSig: string;
  let otherSig: string;
  let addr1Sig: string;
  let owner: SignerWithAddress;
  let other: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let cap: BigNumber;
  let reserved: BigNumber;

  // Configure
  before(async () => {
    console.log(" ");
    [owner, other, addr1, addr2] = await ethers.getSigners();
    console.log("owner: ", owner.address);

    const TestSC = await ethers.getContractFactory("W3NFT");
    // testSC = await TestSC.attach(contractAddress);

    testSC = await TestSC.connect(owner).deploy(
      "W3NFT",
      "W3N",
      {
        coordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
        keyHash: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef",
        subId: "3021",
      },
      owner.address
    );
    await testSC.deployed();
    console.log("contract address:", testSC.address);
    console.log("deployer address:", testSC.deployTransaction.from);

    cap = await testSC.MAX_SUPPLY();
    reserved = await testSC.maxReserve();

    console.log("max reserved:", reserved);
    console.log("max supply:", cap);

    const netId = 31337;
    console.log("chain ID:", netId);

    ownerSig = await signWhitelist(netId, testSC.address, owner, owner.address);
    otherSig = await signWhitelist(netId, testSC.address, owner, other.address);
    addr1Sig = await signWhitelist(netId, testSC.address, owner, addr1.address);
  });

  // #################################################
  // Airdrop (reserve mint)
  // #################################################
  it("fail> airdrop not allow for this sender", async () => {
    console.log("###### START AIRDROP (RESERVE MINT) TEST ##########");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    await expect(testSC.connect(other).airdrop([other.address], reserved)).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("fail> airdrop over reserved", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    await expect(testSC.connect(owner).airdrop([other.address], reserved.add(1))).to.be.revertedWith("InvalidValue");
  });

  it("pass> airdrop from allow sender", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    await testSC.connect(owner).airdrop([other.address], reserved);
    const reservedMinted = await testSC.reserveMinted();
    console.log("reserved minted:", reservedMinted);
    const totalSupply = await testSC.totalSupply();
    console.log("total supply:", totalSupply);
    expect(reservedMinted).equal(reserved);
  });

  // #################################################
  // Private sale
  // #################################################
  it("fail> sale not available due to not enable", async () => {
    console.log("###### START PRIVATE SALE TEST ##########");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> sale not available due to before start time", async () => {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    let curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const beginTime = BigNumber.from(curTime).add(5);
    const minLong = BigNumber.from(5);
    await testSC.connect(owner).enablePrivate(beginTime, minLong);
    const saleTime = await testSC.privateSale();
    console.log("saleTime begin:", saleTime.beginTime);
    console.log("saleTime end:", saleTime.endTime);

    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> whitelist not enable", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    increaseTime(5);

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SignedNotEnabled");
  });

  it("fail> not whitelist/invalid signature", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    await testSC.connect(owner).setSigningAddress(owner.address);
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("InvalidSignature");
  });

  it("fail> exceed transaction limits", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const limit = BigNumber.from(3);
    await testSC.connect(owner).setTransactionLimit(limit, limit, limit, limit);
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(4);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("fail> exceed max supply", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(10001);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("pass> mint 1 token whitelist", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
      value: mintPrice.mul(wantMint),
    });
    const minted = await testSC.privateMinted(addr1.address);
    expect(minted).equal(BigNumber.from(1));
  });

  it("fail> Insufficient funds", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(2);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(1),
      })
    ).to.be.revertedWith("InvalidValue");
  });

  it("pass> mint 2 tokens whitelist", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(2);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
      value: mintPrice.mul(wantMint),
    });

    const minted = await testSC.privateMinted(addr1.address);
    expect(minted).equal(BigNumber.from(3));
  });

  it("fail> Mint limit per wallet exceeded", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("fail> sale not available due to after end block", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    await increaseTime(5 * 60);
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(other).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> Exceed private sale limit", async () => {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    let curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    let curState = await testSC.getState();
    console.log("current state:", curState);
    let curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const limit = BigNumber.from(3);
    const maxPrivate = await testSC.MAX_PRIVATE();
    await testSC.connect(owner).setTransactionLimit(maxPrivate.add(1), limit, maxPrivate.add(1), limit);

    const beginTime = BigNumber.from(curTime).add(5);
    const minLong = BigNumber.from(1);
    await testSC.connect(owner).enablePrivate(beginTime, minLong);

    const saleTime = await testSC.privateSale();
    console.log("saleTime begin:", saleTime.beginTime);
    console.log("saleTime end:", saleTime.endTime);

    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    increaseTime(5);

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(maxPrivate);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(owner).mintToken(wantMint, ownerSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("pass> private sale soldout", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    let curState = await testSC.getState();
    console.log("current state:", curState);
    let curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const maxPrivate = await testSC.MAX_PRIVATE();
    const privateMinted = await testSC.privateMinted(addr1.address);
    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(maxPrivate.sub(privateMinted));
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr1).mintToken(wantMint, addr1Sig, {
      value: mintPrice.mul(wantMint),
    });

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const minted = await testSC.privateMinted(addr1.address);
    expect(minted).equal(maxPrivate);

    await expect(
      testSC.connect(other).mintToken(BigNumber.from(1), otherSig, {
        value: mintPrice.mul(1),
      })
    ).to.be.revertedWith("SaleNotAvailable");

    increaseTime(1 * 60);

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);
  });

  // #################################################
  // Public sale
  // #################################################
  it("fail> sale not available due to not enable", async () => {
    console.log("###### START PUBLIC SALE TEST ##########");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    await testSC.connect(owner).setReduceTime(BigNumber.from(5));
    await testSC.connect(owner).togglePublicDA();
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> sale not available due to before start time", async () => {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    let curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const beginTime = BigNumber.from(curTime).add(5);
    const minLong = BigNumber.from(20);

    await testSC.connect(owner).enablePublic(beginTime, minLong);
    const saleTime = await testSC.publicSale();
    console.log("saleTime begin:", saleTime.beginTime);
    console.log("saleTime end:", saleTime.endTime);

    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> exceed transaction limits", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    increaseTime(5);

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(4);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("pass> mint 1 token public", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr2).mintToken(wantMint, otherSig, {
      value: mintPrice.mul(wantMint),
    });
    const minted = await testSC.numberMinted(addr2.address);
    const pvMinted = await testSC.privateMinted(addr2.address);
    const difMinted = minted.sub(pvMinted);
    expect(difMinted).equal(BigNumber.from(1));
  });

  it("fail> Insufficient funds", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(2);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(1),
      })
    ).to.be.revertedWith("InvalidValue");
  });

  it("pass> mint 2 tokens public", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    let mintPrice = await testSC.priceByMode();
    console.log("sale price:", BigNumber.from(mintPrice));
    await increaseTime(5 * 60);
    mintPrice = await testSC.priceByMode();
    console.log("sale price:", BigNumber.from(mintPrice));
    await increaseTime(5 * 60);
    mintPrice = await testSC.priceByMode();
    console.log("sale price:", BigNumber.from(mintPrice));
    await increaseTime(5 * 60);
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(2);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr2).mintToken(wantMint, otherSig, {
      value: mintPrice.mul(wantMint),
    });

    const minted = await testSC.numberMinted(addr2.address);
    const pvMinted = await testSC.privateMinted(addr2.address);
    const difMinted = minted.sub(pvMinted);
    expect(difMinted).equal(BigNumber.from(3));
  });

  it("fail> Mint limit per wallet exceeded", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("fail> sale not available due to after end block", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    await increaseTime(5 * 60);

    const curState = await testSC.getState();
    console.log("current state:", curState);
    const curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(1);
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("SaleNotAvailable");
  });

  it("fail> exceed max supply", async () => {
    let blockNum = await ethers.provider.getBlockNumber();
    let block = await ethers.provider.getBlock(blockNum);
    let curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    let curState = await testSC.getState();
    console.log("current state:", curState);
    let curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const limit = BigNumber.from(3);
    await testSC.connect(owner).setTransactionLimit(limit, cap, limit, cap);
    await testSC.connect(owner).togglePublicDA();

    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const beginTime = BigNumber.from(curTime).add(5);
    const minLong = BigNumber.from(1);
    await testSC.connect(owner).enablePublic(beginTime, minLong);

    const saleTime = await testSC.publicSale();
    console.log("saleTime begin:", saleTime.beginTime);
    console.log("saleTime end:", saleTime.endTime);
    blockNum = await ethers.provider.getBlockNumber();
    block = await ethers.provider.getBlock(blockNum);
    curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    increaseTime(5);

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const totalSupply = await testSC.totalSupply();
    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(cap.sub(totalSupply).add(1));
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await expect(
      testSC.connect(addr2).mintToken(wantMint, otherSig, {
        value: mintPrice.mul(wantMint),
      })
    ).to.be.revertedWith("ExceedLimit");
  });

  it("pass> public sale soldout", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));

    let curState = await testSC.getState();
    console.log("current state:", curState);
    let curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const totalSupply = await testSC.totalSupply();
    const mintPrice = await testSC.priceByMode();
    const wantMint = BigNumber.from(cap.sub(totalSupply));
    console.log("sale price:", BigNumber.from(mintPrice));
    console.log("want mint:", BigNumber.from(wantMint));

    await testSC.connect(addr2).mintToken(wantMint, otherSig, {
      value: mintPrice.mul(wantMint),
    });

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);

    const minted = await testSC.totalSupply();
    expect(minted).equal(cap);

    await expect(
      testSC.connect(other).mintToken(BigNumber.from(1), otherSig, {
        value: mintPrice.mul(1),
      })
    ).to.be.revertedWith("SaleNotAvailable");

    increaseTime(1 * 60);

    curState = await testSC.getState();
    console.log("current state:", curState);
    curPhase = await testSC.salePhase();
    console.log("current phase:", curPhase);
  });

  // #################################################
  // Release Fund
  // #################################################
  it("fail> Release to others wallet", async () => {
    console.log("###### START RELEASE FUND TEST ##########");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    await expect(testSC.connect(owner).withdraw(other.address)).to.be.revertedWith("InvalidAddress");
  });

  it("pass> Release to allow wallet", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const fundBefore = await owner.getBalance();
    await testSC.connect(owner).withdraw(owner.address);
    const fundAfter = await owner.getBalance();
    console.log("fund before:", BigNumber.from(fundBefore));
    console.log("fund after:", BigNumber.from(fundAfter));
    expect(fundAfter).gt(fundBefore);
  });

  // #################################################
  // Seed and metaId
  // #################################################
  it("pass> setManualSeed", async () => {
    console.log("###### START RANDOM METADATA ID TEST ##########");
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    const preURI = "https://cf-ipfs.com/ipfs/QmPUHWLrMCyWtLzBKG9nHWzm3Mmyz8wSHvEcTTuggvmnne";
    const baseURI = "https://cf-ipfs.com/ipfs/QmZwj1Td1moto6w728LhDMcEZvrAK6DGAoC8Cftq5W5ojP/";
    console.log("current time:", BigNumber.from(curTime));
    await testSC.connect(owner).setPreURI(preURI);
    await testSC.connect(owner).setBaseURI(baseURI);
    await testSC.connect(owner).randomSeed(6354725381);
    const seed = await testSC.seed();
    console.log("seed:", seed);
    const metaId = await testSC.metaId(2345);
    console.log("metaId (2345):", metaId);
    expect(metaId).not.equal(2345);

    const tokenURI = await testSC.tokenURI(2345);
    console.log("tokenURI (2345):", tokenURI);
    expect(tokenURI).equal(preURI);
  });

  it("pass> revealed", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const baseURI = await testSC.baseURI();
    console.log("baseURI:", baseURI);
    let revealed = await testSC.revealed();
    console.log("revealed before:", revealed);
    await testSC.connect(owner).reveal();
    revealed = await testSC.revealed();
    console.log("revealed after:", revealed);
    const metaId = await testSC.metaId(6758);
    console.log("metaId (6758):", metaId);
    expect(metaId).not.equal("6758");
    const tokenURI = await testSC.tokenURI(6758);
    console.log("tokenURI (6758):", tokenURI);
    expect(tokenURI).contain(baseURI);
  });

  it("pass> get last id URI", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const baseURI = await testSC.baseURI();
    console.log("baseURI:", baseURI);
    const metaId = await testSC.metaId(10000);
    console.log("metaId (10000):", metaId);
    expect(metaId).not.equal("10000");
    const tokenURI = await testSC.tokenURI(10000);
    console.log("tokenURI (10000):", tokenURI);
    expect(tokenURI).contain(baseURI);
  });

  it("pass> get vault reserve URI", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const baseURI = await testSC.baseURI();
    console.log("baseURI:", baseURI);
    const vaultReserve = await testSC.VAULT_RESERVE();
    console.log("vaultReserve:", vaultReserve);
    for (let i = 1; i <= vaultReserve.toNumber(); i++) {
      const metaId = await testSC.metaId(i);
      console.log("metaId (", i, "): ", metaId);
      expect(metaId).equal(i.toString());
      const tokenURI = await testSC.tokenURI(i);
      console.log("tokenURI (", i, "): ", tokenURI);
      expect(tokenURI).equal(`${baseURI}${i.toString()}.json`);
    }
  });

  it("pass> get first after vault reserve URI", async () => {
    const blockNum = await ethers.provider.getBlockNumber();
    const block = await ethers.provider.getBlock(blockNum);
    const curTime = block.timestamp;
    console.log("current time:", BigNumber.from(curTime));
    const baseURI = await testSC.baseURI();
    console.log("baseURI:", baseURI);
    const firstAfterVault = (await testSC.VAULT_RESERVE()).toNumber() + 1;
    console.log("firstAfterVault:", firstAfterVault);
    const metaId = await testSC.metaId(firstAfterVault);
    console.log("metaId (", firstAfterVault, "): ", metaId);
    expect(metaId).not.equal(firstAfterVault.toString());
    const tokenURI = await testSC.tokenURI(firstAfterVault);
    console.log("tokenURI (", firstAfterVault, "): ", tokenURI);
    expect(tokenURI).contain(baseURI);
  });
});

async function signWhitelist(chainId: number, contractAddress: string, whitelistKey: SignerWithAddress, mintingAddress: string): Promise<string> {
  // Domain data should match whats specified in the DOMAIN_SEPARATOR constructed in the contract
  const domain = {
    name: "EIP712SignedData",
    version: "1",
    chainId,
    verifyingContract: contractAddress,
  };

  // The types should match the TYPEHASH specified in the contract
  const types = {
    Minter: [{ name: "wallet", type: "address" }],
  };

  const sig = await whitelistKey._signTypedData(domain, types, {
    wallet: mintingAddress,
  });

  console.log("mint address: ", mintingAddress);
  console.log("signature: ", sig);

  return sig;
}

async function increaseTime(n: number) {
  await ethers.provider.send("evm_increaseTime", [n]);
  await ethers.provider.send("evm_mine", []);
  const blockNum = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNum);
  const curTime = block.timestamp;
  console.log("current time:", BigNumber.from(curTime));
}
