import { ethers } from "hardhat";

async function main() {
  const DeployContract = await ethers.getContractFactory("W3NFT");
  const deployContract = await DeployContract.deploy(
    "Pride Demons",
    "DEMONS",
    {
      coordinator: "0x271682DEB8C4E0901D1a1550aD2e64D568E69909",
      keyHash: "0x8af398995b04c28e9951adb9721ef74c74f93e6a478f39e7e0777be13527e7ef",
      subId: "3021"
    },
    "0x94021138093918b6E0DDb275272bD638C22df912"
  );

  await deployContract.deployed();

  console.log("DeployContract deployed to:", deployContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
