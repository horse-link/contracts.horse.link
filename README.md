# horse.link contracts

## Scripts

### hh:compile
Compiles the contracts with Hardhat

### hh:deploy
Runs the deployment script with the network set in `process.env.NETWORK`.

### hh:node
Starts a local hardhat node with the `localhost` network.

## Contracts
Contracts are located in the `/contracts` folder.

## Configuration
See `/hardhat.config.ts` for hardhat configuration. Some values are fetched from environment variables, see `dev.env` for local development environment variables and copy it into `.env` before changing the values.

## Deployment
TODO: How to deploy

### Deployment to Goerli

### Deployment to Local

### Deployment to Mainnet



### Contract addresses
Deployed addresses are saved in `/contracts.json` for each network. This file should be committed so that addresses are managed by git.

## Hardhat Tasks
Tasks are located in the `/scripts/tasks` folder.
A hardhat task allows for easy contract interaction from the command line. To run a contract task, run a command with the following structure:
```bash
npx hardhat <taskName>
  --network <networkName>
  [--argName <argValue>]
```
For the local hardhat network, use the default `localhost` value for `networkName`. 

### Example template tasks
#### accounts
```bash
npx hardhat accounts --network localhost
```
Output:
```
0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510: 10.0 ETH
```
#### mint
Minting the deployed example `Token.sol` as an ERC20 with 0 decimals.
```bash
npx hardhat mint --amount 1 --address 0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510 --network localhost
```
Output:
```
network is localhost
token address is 0x47A78de7a881CCa1a0f510efA2E520b447F707Bb
waiting for confirmation...
minted 1 for address 0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510
```
#### read-balance
Reading balance for the deployed example `Token.sol` as an ERC20 with 0 decimals.
```bash
npx hardhat read-balance --address 0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510 --network localhost
```
Output:
```
network is localhost
token address is 0x47A78de7a881CCa1a0f510efA2E520b447F707Bb
balance is 1 wei for address 0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510
```

## Running settle script

Setup the local Python environment:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Run the script:

```bash
python scripts/settle.py
```