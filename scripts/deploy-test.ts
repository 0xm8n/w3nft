import { ethers } from "hardhat";

async function main() {
  const DeployContract = await ethers.getContractFactory("W3NFT");
  const deployContract = await DeployContract.deploy(
    "Pride Demons",
    "DEMONS",
    {
      coordinator: "0x6168499c0cFfCaCD319c818142124B7A15E857ab",
      keyHash: "0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc",
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
