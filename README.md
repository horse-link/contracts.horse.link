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

### Token

### Vaults
The Vault contracts are ERC4626 contracts used to store the assets of the users. They are used to store the assets of the users and to allow them to deposit and withdraw assets that get lent to the Market contracts for a fee.  The users are minted a ERC20 share that represents their share of the underlying assets in the Vault.

The following is a worked example on how the relationship between users deposits and their shares work.

1. Alice deposits 1000 DAI into the Vault and receives 1000 shares.
2. Bob deposits 1000 DAI into the Vault and receives 1000 shares.

| User | Action | Amount | Shares | Total Assets | Total Shares |
| ---- | ------ | ------ | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000 | 1000 DAI | 1000 |
| Bob | Deposit | 1000 DAI | 1000 | 2000 DAI | 2000 |

The Vault is now holding 2000 DAI in "totalAssets".  If Alice withdraws 500 shares, she will receive 500 DAI.  Now, lets say a bet of 1800 DAI is placed on a market that is backed by the Vault at 1:1.  The Vault will lend 1800 DAI to the market and have a total assets of 200 DAI and total exposure of 1800 DAI.

3. Vault lends 1800 DAI to the market and has 200 DAI left in total assets.

| User | Action | Amount | Shares | Total Assets | Total Shares |
| ---- | ------ | ------ | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000 | 1000 DAI | 1000 |
| Bob | Deposit | 1000 DAI | 1000 | 2000 DAI | 2000 |
| Vault | Lend | 1800 DAI | 0 | 200 DAI | 2000 |

While the bet is active, Alice can redeem her 1000 shares if she chooses so, but will but the exchange rate per share will be significantly lower than 1 DAI per share.  Her share is represented by the following equation:

```text
share = (totalAssets * shares) / totalShares
```

Eg:
``` text
share = (200 * 1000) / 2000 = 100 DAI
```

Upon redeeming the shares will be burnt and Alice share balance will be 0.  The Vault will have 1100 DAI in total assets and 1000 shares.

4. Alice redeems 1000 shares for 100 DAI.

| User | Action | Amount | Shares | Total Assets | Total Shares |
| ---- | ------ | ------ | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000 | 1000 DAI | 1000 |
| Bob | Deposit | 1000 DAI | 1000 | 2000 DAI | 2000 |
| Vault | Lend | 1800 DAI | 0 | 200 DAI | 2000 |
| Alice | Redeem | 100 DAI | 1000 | 100 DAI | 1000 |

The bet is now settled and the Vault has an exposure of 0 DAI and has made 1800 DAI on the loosing bet.  The total assets in the Vault are now ...

5. Vault settles the bet and has now 3700 DAI in total assets, while the total shares are still 1000.

| User | Action | Amount | Shares | Total Assets | Total Shares |
| ---- | ------ | ------ | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000 | 1000 DAI | 1000 |
| Bob | Deposit | 1000 DAI | 1000 | 2000 DAI | 2000 |
| Vault | Lend | 1800 DAI | 0 | 200 DAI | 2000 |
| Alice | Redeem | 100 DAI | 1000 | 100 DAI | 1000 |
| Market | Settle | 3600 DAI | 0 | 3700 DAI | 1000 |

The Vault is now holding 3700 DAI in total assets and 1000 shares.  If Alice redeems her shares, she will receive 370 DAI.

#### Analysing a donation attack.

A donation attack is when a user deposits a large amount of assets into the Vault without incrementing the balance from the deposit function, skewing the ratio of assets to shares.  https://forum.openzeppelin.com/t/erc4626-vault-implementation-for-totalassets-in-base-contract/29474.  In our use case, we discuss the attempt for an attacker could attempt to place a large bet draining the vault, then deposit a large amount of assets into the Vault to skew the ratio of assets to shares.

| User | Action | Amount | Shares | Total Assets | Total Shares |
| ---- | ------ | ------ | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000 | 1000 DAI | 1000 |
| Bob | Deposit | 1000 DAI | 1000 | 2000 DAI | 2000 |
| Vault | Lend | 1800 DAI | 0 | 200 DAI | 2000 |
| Attacker | Deposit | 100000 DAI | 100000 | 100200 DAI | 102000 |
| Market | Settle | 3600 DAI | 0 | 3700 DAI | 102000 |

### Markets

Markets define the logic in which they calculate the odds per event or market.  Our solution offers two market contracts, will odds slippage either on a linear decay or a non-linear decay.  The linear decay market is a simple market that calculates the odds based on the total assets in the Vault and the total exposure of the Vault.  The non-linear decay market is more complex and is more expensive to calculate the odds, but it is more accurate in calculating the odds.

Markets can either be "Greedy" or "Not Greedy".

#### Greedy Markets
Greedy markets draw 100% of the lay colleateraly from the Vault.  This is favourable for Vault owners, as they get maximum dividends for collateral they lend, 

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