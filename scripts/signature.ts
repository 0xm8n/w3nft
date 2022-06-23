import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { Wallet } from "ethers";
import { appendFileSync, writeFileSync } from "fs";

dotenv.config();

const cid = 4; // 4:rinkeby 1:mainnet
const conaddr = process.env.CONTRACT || "";
const wlsigner = new ethers.Wallet(process.env.PRIVATE_KEY || "");
const wladdr: string[] = ["0x94021138093918b6E0DDb275272bD638C22df912", "0xA7eC6bE5bECD2B3d549826444ABe0EDB78E4Fbb2"];
const wlFileName = "wl.txt";
const wlLastId = wladdr.length - 1;

async function signWhitelist(chainId: number, contractAddress: string, whitelistKey: Wallet, mintingAddress: string): Promise<string> {
  // Domain data should match whats specified in the DOMAIN_SEPARATOR constructed in the contract
  // https://github.com/msfeldstein/EIP712-whitelisting/blob/main/contracts/EIP712Whitelisting.sol#L33-L43
  const domain = {
    name: "WhitelistToken",
    version: "1",
    chainId,
    verifyingContract: contractAddress,
  };

  // The types should match the TYPEHASH specified in the contract
  // https://github.com/msfeldstein/EIP712-whitelisting/blob/main/contracts/EIP712Whitelisting.sol#L27-L28
  const types = {
    Minter: [{ name: "wallet", type: "address" }],
  };

  const sig = await whitelistKey._signTypedData(domain, types, {
    wallet: mintingAddress,
  });

  return sig;
}

function genWLFile() {
  for (let i = 0; i <= wlLastId; i++) {
    signWhitelist(cid, conaddr, wlsigner, wladdr[i]).then((res) => {
      if (i === 0) {
        writeFileSync(wlFileName, '{"address":"' + wladdr[i] + '","signature":"' + res + '"}\n');
      } else {
        appendFileSync(wlFileName, '{"address":"' + wladdr[i] + '","signature":"' + res + '"}\n');
      }
      console.log('{"address":"' + wladdr[i] + '","signature":"' + res + '"}');
    });
  }
}

genWLFile();

export default signWhitelist;
