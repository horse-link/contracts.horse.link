# horse.link contracts

## Scripts

### hh:compile

Compiles the contracts with Hardhat

### hh:deploy

Runs the deployment script with the network set in `process.env.NETWORK`.

### hh:node

Starts a local hardhat node with the `localhost` network.

## Contracts

There are 5 main types of contracts along with supporting solidity libraries, which are located in the `/contracts` folder.

1. Token `Token.sol`
2. Vault `Vault.sol`
3. Market `Market.sol` and `MarketCurved.sol`
4. Oracle `MarketOracle.sol`
5. Registry `Registry.sol`

### Token

Horse Link issues 100 million standard ERC20 tokens HL / Horse Link for its members to be used in the future as a DAO governance token, distribution of protocol fees and other member perks.

### Vaults

The Vault contracts are ERC4626 contracts used to manage the underlying ERC20 assets of the LP Providers. They are used to store the assets of the users and to allow them to deposit and withdraw assets that get lent to Market contracts for a fee which is agreed upon in the `setMarket` function. The users are minted a ERC20 share that represents their share of the underlying assets in the Vault.

The following is a worked example of the relationship between users' deposits and shares.

1. Alice deposits 1000 DAI into the Vault and receives 1000 shares.

| User  | Action  | Amount   | Shares | Total Assets | Total Shares |
| ----- | ------- | -------- | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |

Initial share price is 1 DAI so Alice receives 1000 shares.

2. Bob deposits 1000 DAI into the Vault and receives 1000 shares.

| User  | Action  | Amount   | Shares | Total Assets | Total Shares |
| ----- | ------- | -------- | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob   | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |

Number of shares received when depositing is represented by the following equation:

```text
shares received = total shares / total assets * deposit
```

So when Bob deposits 1000 DAI they receive 1000 shares:

```text
shares received = 1000 / 1000 * 1000 = 1000
```

The Vault is now holding 2000 DAI in "totalAssets". If Alice withdraws 500 shares, she will receive 500 DAI. Now, let's say Carol places a bet of 1800 DAI on a market that is backed by the Vault at 1:1. The Vault will lend 1800 DAI to the market. 200 DAI remain in the vault and it will have a total exposure of 1800 DAI.

3. Carol places bet of 1800 DAI at 1:1 odds

| User                      | Action  | Amount   | Shares | Total Assets | Total Shares |
| ------------------------- | ------- | -------- | ------ | ------------ | ------------ |
| Alice                     | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob                       | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |
| Vault (on Carol's behalf) | Lend    | 1800 DAI | 0      | 200 DAI      | 2000         |

Vault lends 1800 DAI to the market (to cover the exposure for Carol's bet) and has 200 DAI left in total assets.

While Carol's bet is active, Alice can redeem her 1000 shares if she chooses so, but the exchange rate per share will be significantly lower than 1 DAI per share. Her share is represented by the following equation:

```text
share = totalAssets * shares / totalShares
```

Eg:

```text
share = 200 * 1000 / 2000 = 100 DAI
```

Upon redeeming, Alice's shares would be burnt.

4. Alice redeems 1000 shares for 100 DAI.

| User                      | Action  | Amount   | Shares | Total Assets | Total Shares |
| ------------------------- | ------- | -------- | ------ | ------------ | ------------ |
| Alice                     | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob                       | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |
| Vault (on Carol's behalf) | Lend    | 1800 DAI | 0      | 200 DAI      | 2000         |
| Alice                     | Redeem  | 100 DAI  | (1000) | 100 DAI      | 1000         |

Alice's shares are burnt, reducing her share balance to 0. The Vault will have 100 DAI in total assets and 1000 shares.

5. Vault settles Carol's bet and has now 3700 DAI in total assets, while the total shares are still 1000 DAI.

| User                                    | Action  | Amount   | Shares | Total Assets | Total Shares |
| --------------------------------------- | ------- | -------- | ------ | ------------ | ------------ |
| Alice                                   | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob                                     | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |
| Vault (on Carol's behalf)               | Lend    | 1800 DAI | 0      | 200 DAI      | 2000         |
| Alice                                   | Redeem  | 100 DAI  | (1000) | 100 DAI      | 1000         |
| Market (profit from Carol's losing bet) | Settle  | 3600 DAI | 0      | 3700 DAI     | 1000         |

Carol's bet is now settled and the Vault has an exposure of 0 DAI and has made 1800 DAI on the losing bet. The profit and exposure are returned to the vault. The total assets in the Vault are now 3700 DAI.

If the bet was a winning bet, the market pays out the winning proposition. The performance of the Vault would be low, as the bettor has won assets from the Market, which will now not be returned to the Vault.

The perfomance of the Vault is the ratio of the shares to the assets. In the above example, the performance is: 3700 DAI / 1000 shares \* 100 = 370% (3.7 DAI per share).

#### Analysing a donation attack

A donation attack is when a user deposits a large amount of assets into the Vault without incrementing the balance from the deposit function, skewing the ratio of assets to shares. https://forum.openzeppelin.com/t/erc4626-vault-implementation-for-totalassets-in-base-contract/29474. In our use case, we discuss the possibility that an attacker could attempt to place a large bet, draining the vault, then deposit a large amount of assets into the Vault to skew the ratio of assets to shares.

| User                         | Action  | Amount    | Shares | Total Assets | Total Shares |
| ---------------------------- | ------- | --------- | ------ | ------------ | ------------ |
| Alice                        | Deposit | 1000 DAI  | 1000   | 1000 DAI     | 1000         |
| Bob                          | Deposit | 1000 DAI  | 1000   | 2000 DAI     | 2000         |
| Vault (on attacker's behalf) | Lend    | 1800 DAI  | 0      | 200 DAI      | 2000         |
| Attacker                     | Deposit | 10000 DAI | 100000 | 10200 DAI    | 102000       |

In the above example, the Vault had 200 DAI in total assets and 2000 shares. The performance of the Vault is 200 / 2000 = 0.1 devaluing each share making them comparitively cheap for the attacker.

```text
shares received = 2000 / 200 * 10000 = 100000
```

The attacker loses their bet and it is settled, casuing the market to return the profit and exposure.

| User                                       | Action  | Amount       | Shares   | Total Assets | Total Shares |
| ------------------------------------------ | ------- | ------------ | -------- | ------------ | ------------ |
| Alice                                      | Deposit | 1000 DAI     | 1000     | 1000 DAI     | 1000         |
| Bob                                        | Deposit | 1000 DAI     | 1000     | 2000 DAI     | 2000         |
| Vault (on attacker's behalf)               | Lend    | 1800 DAI     | 0        | 200 DAI      | 2000         |
| Attacker                                   | Deposit | 10000 DAI    | 100000   | 10200 DAI    | 102000       |
| Market (profit from Attacker's losing bet) | Settle  | 3600 DAI     | 0        | 13800 DAI    | 102000       |
| Attacker                                   | Redeem  | 13529.41 DAI | (100000) | 270.59 DAI   | 2000         |

The attacker redeems their shares for 13529.41 DAI:

```text
share = 13800 * 100000 / 102000 = 13529.41
```

The total assets in the vault is now 270.59 DAI giving a performance of: 270.59 DAI / 2000 shares \* 100 = 13.52% (0.14 DAI per share) compared to before the attack when the performance was 2000 DAI / 2000 shares \* 100 = 100% (1 DAI per share).

### Market

Market contracts define the logic in which they calculate the odds per event or market. Our protocol offers two types of market contracts, where the odds slippage calculation is either on a linear decay or a non-linear decay. The linear decay market `Market.sol` is a simple market that calculates the odds based on the total assets in the Vault and the total exposure of the Vault. The non-linear decay market `MarketCurved.sol` is more complex and is more expensive to calculate the odds, but offers smoother odds to its caller.

```text
o = O - O * (w / (v + (sm - sp)))
```

where

```text
o = Offered odds
O = Market fixed odds
v = Vault total assets
w = Wager amount
sm = Sum of all wagers on that market
sp = Sum of all wagers on that proposition
```

The market contract implements the ERC721 standard to issue betslips as NFTs. Bets are settled by invoking the `settle` function along with the respective NFT token ID once the `MarketOracle.sol` result has been set. Should the Oracle not be updated within 30 days, the `settle` function will pay out the proposition regardless. This prevents the market operator not to unfairly withhold users assets.

Markets can either be "Greedy" or "Not Greedy", but for v1.0 we assume Greedy Markets.

#### Greedy Markets

Greedy markets draw 100% of the lay collateral from the Vault. This is favourable for Vault owners, as they get maximum dividends for collateral they lend.

```text
Given calculated odds are 3:1,
And the Vault has 10,000 assets,
And the Market balance is 250 assets
When a bet of 100 assets is placed
Then the Vault lends 300 assets to the Market
```

### Non Greedy Markets

Markets that are non greedy use the collateral under management first, instead of transferring assets from the connected Vault.

```text
Given calculated odds are 3:1,
And the Vault has 10,000 assets,
And the Market has 250 assets,
And the runner being bet on has 0 existing bets
When a bet of 100 assets is placed
Then the Vault lends 50 assets to the Market
```

### Registry

The registry contract is a mapping of Vaults and Markets used by the protocol. This allows a single source of truth for calling applications and smart contracts. It also has the ability to only allow token holders to modify the contracts it registers.

### Oracle

The `MarketOracle.sol` contract allows authorised accounts to set results based on the Market ID and the Proposition ID. The results are either set from a python script `settle.py` in the event of a losing Proposition or by the front end should the user win and claim their profits. The market owner is responsible for providing a signed result after the event.

## Configuration

See `/hardhat.config.ts` for hardhat configuration. Some values are fetched from environment variables, see `.env.development` for local development environment variables and copy it into `.env` before changing the values.

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
