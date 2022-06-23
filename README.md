# Setup
1. create account at https://alchemy.com/?r=c1db09d93c9bb78c then create ropsten and mainnet application.
2. signup https://etherscan.io/ and create apikey
3. create .env file follow .env.example and update value
4. create new metamask wallet for test, recommend to use different browser from real account
5. get free test ETH from https://faucet.metamask.io/ or https://faucet.paradigm.xyz/

# Test
1. Copy contracts and manual dependency from etherscan in to new project folder, exclude openzepeelin.
2. Copy scripts project folder and rename to the same name as contracts project folder
3. update mint.ts parameter and logic to check contract parameter for public mint open.
4. update project name in .env file
5. update deploy.ts and constructor param in arguments.ts
6. deploy to ropsten testnet
7. update contract address in .env file
8. verify to ropsten testnet
9. run mint scripts and wait for script start to check contract parameter and return "Public mint is CLOSE"
10. open ropsten etherscan and search contract address, then go to write contract and call function to update parameter
11. after parameter update to the block script should return "Public mint is OPEN !!!" and start to mint.
12. wait for mint result, check if error, also check on etherscan

# Command
Try running some of the following tasks:
```shell
npm run deploy
npm run verify
npm run mint
npm run main:mint
```