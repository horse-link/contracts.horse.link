[![Unit Tests](https://github.com/horse-link/contracts.horse.link/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/horse-link/contracts.horse.link/actions/workflows/test.yml)

# horse.link contracts

## Scripts

### hh:compile

Compiles the contracts with Hardhat

### hh:deploy

Runs the deployment script with the network set in `process.env.NETWORK`.

### hh:node

Starts a local Hardhat node with the `localhost` network.

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

The Vault is now holding 2000 DAI in "totalAssets". If Alice redeems 500 shares, she will receive 500 DAI. Now, let's say Carol places a bet of 1800 DAI on a market that is backed by the Vault at 1:1. The Vault will lend 1800 DAI to the market. 200 DAI remain in the Vault and it will have a total exposure of 1800 DAI.

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

| User                                     | Action  | Amount   | Shares | Total Assets | Total Shares |
| ---------------------------------------- | ------- | -------- | ------ | ------------ | ------------ |
| Alice                                    | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob                                      | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |
| Vault (on Carol's behalf)                | Lend    | 1800 DAI | 0      | 200 DAI      | 2000         |
| Alice                                    | Redeem  | 100 DAI  | (1000) | 100 DAI      | 1000         |
| Market (revenue from Carol's losing bet) | Settle  | 3600 DAI | 0      | 3700 DAI     | 1000         |

Carol's bet is now settled and the Vault has an exposure of 0 DAI and has made 1800 DAI on the losing bet. The profit and exposure are returned to the Vault. The total assets in the Vault are now 3700 DAI.

If the bet was a winning bet, the market pays out the winning proposition. The performance of the Vault would be low, as the bettor has won assets from the Market, which will now not be returned to the Vault.

The performance of the Vault is the ratio of the shares to the assets. In the above example, the performance is: 3700 DAI / 1000 shares \* 100 = 370% (3.7 DAI per share).

#### Analysing a donation attack

The donation attack (aka inflation attack) is a known exploit with ERC4626 vaults when the amount of underlying assets change without the amount of shares reflecting that. This makes all the share more (or less) valuable, which means that someone receiving shares will get less (or more) than they would have expected. The bigger the inflation (or deflation), the bigger the effect of the attack, which makes Horse Link particularly sensitive as the vaults balance can change significatly when funds are withdrawn to cover the exposure of bets.

In our use case, we discuss the possibility that an attacker could attempt to place a bet with high odds, draining the Vault, then deposit a large amount of assets into the Vault to skew the ratio of assets to shares.

1. Assuming Alice and Bob have deposited into the Vault as shown in Vault example above

| User  | Action  | Amount   | Shares | Total Assets | Total Shares |
| ----- | ------- | -------- | ------ | ------------ | ------------ |
| Alice | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob   | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |

2. Attacker makes a 10 DAI bet on runner with odds of 180:1

| User                         | Action  | Amount   | Shares | Total Assets | Total Shares |
| ---------------------------- | ------- | -------- | ------ | ------------ | ------------ |
| Alice                        | Deposit | 1000 DAI | 1000   | 1000 DAI     | 1000         |
| Bob                          | Deposit | 1000 DAI | 1000   | 2000 DAI     | 2000         |
| Vault (on attacker's behalf) | Lend    | 1800 DAI | 0      | 200 DAI      | 2000         |

Vault lends 1800 DAI to the market (to cover the exposure for the attackers's bet) leaving 200 DAI of total assets. Given the Vault now has 200 DAI in total assets but still 2000 shares, the performance of the Vault is 200 / 2000 = 0.1 devaluing each share making them comparatively cheap for the attacker to acquire.

3. Attacker deposits 10,000 DAI and receives 100,000 shares

| User                         | Action  | Amount    | Shares | Total Assets | Total Shares |
| ---------------------------- | ------- | --------- | ------ | ------------ | ------------ |
| Alice                        | Deposit | 1000 DAI  | 1000   | 1000 DAI     | 1000         |
| Bob                          | Deposit | 1000 DAI  | 1000   | 2000 DAI     | 2000         |
| Vault (on attacker's behalf) | Lend    | 1800 DAI  | 0      | 200 DAI      | 2000         |
| Attacker                     | Deposit | 10000 DAI | 100000 | 10200 DAI    | 102000       |

```text
shares received = 2000 / 200 * 10000 = 100000
```

4. The attacker loses their bet and it is settled, causing the market to return the profit and exposure.

| User                                        | Action  | Amount    | Shares | Total Assets | Total Shares |
| ------------------------------------------- | ------- | --------- | ------ | ------------ | ------------ |
| Alice                                       | Deposit | 1000 DAI  | 1000   | 1000 DAI     | 1000         |
| Bob                                         | Deposit | 1000 DAI  | 1000   | 2000 DAI     | 2000         |
| Vault (on attacker's behalf)                | Lend    | 1800 DAI  | 0      | 200 DAI      | 2000         |
| Attacker                                    | Deposit | 10000 DAI | 100000 | 10200 DAI    | 102000       |
| Market (revenue from Attacker's losing bet) | Settle  | 1810 DAI  | 0      | 12010 DAI    | 102000       |

5. The attacker redeems their shares for 11774.51 DAI

| User                                        | Action  | Amount       | Shares   | Total Assets | Total Shares |
| ------------------------------------------- | ------- | ------------ | -------- | ------------ | ------------ |
| Alice                                       | Deposit | 1000 DAI     | 1000     | 1000 DAI     | 1000         |
| Bob                                         | Deposit | 1000 DAI     | 1000     | 2000 DAI     | 2000         |
| Vault (on attacker's behalf)                | Lend    | 1800 DAI     | 0        | 200 DAI      | 2000         |
| Attacker                                    | Deposit | 10000 DAI    | 100000   | 10200 DAI    | 102000       |
| Market (revenue from Attacker's losing bet) | Settle  | 1810 DAI     | 0        | 12010 DAI    | 102000       |
| Attacker                                    | Redeem  | 11774.51 DAI | (100000) | 235.49 DAI   | 2000         |

```text
share = 12010 * 100000 / 102000 = 11774.51
```

The attacker spent 10 DAI to place the bet, 10000 depositing into Vault and was able to redeem 11774.51 resulting in a profit of 1764.51 DAI.

The total assets in the Vault is now 235.49 DAI giving a performance of: 235.49 DAI / 2000 shares \* 100 = 11.77% (0.12 DAI per share) compared to before the attack when the performance was 2000 DAI / 2000 shares \* 100 = 100% (1 DAI per share).

### Market

Market contracts define the logic in which they calculate the odds per event or market. Our protocol offers two types of market contracts, where the odds slippage calculation is either on a linear decay or a non-linear decay. The linear decay market `Market.sol` is a simple market that calculates the odds based on the total assets in the Vault and the total exposure of the Vault. The non-linear decay market `MarketCurved.sol` is more complex and is more expensive to calculate the odds, but offers smoother odds to its caller.


Non collateralised markets draw 100% of the lay collateral from the Vault.
```text
o = O * O * w / (v + w)
```

Collateralised markets use the lay collateral in the total liquidity available to calculate the odds.
```text
o = O - O * (w / (v + (sm - sp)))
```

where

```text
o = Actual odds
O = Offered odds
v = Vault liquidity
w = Wager amount
sm = Sum of all wagers on that market
sp = Sum of all wagers on that proposition
```

The market contract implements the ERC721 standard to issue betslips as NFTs. Bets are settled by invoking the `settle` function along with the respective NFT token ID once the `MarketOracle.sol` result has been set. Should the Oracle not be updated within 30 days, the `settle` function will pay out the proposition regardless. This prevents the market operator not to unfairly withhold users assets.

Markets can either be "Collateralised" or "Non-collateralised", but for v1.0 we assume Non-collateralised Markets.

#### Non-collateralised Markets

Non-Collateralised markets draw 100% of the lay collateral from the Vault. This is favourable for Vault owners, as they get maximum dividends for collateral they lend.

```text
Given calculated target odds are 5.0,
And the Vault has 1,000 tokens,
When a bet of 50 tokens is placed
Then the true odds are 4.75
And Vault lends 137.50 tokens to the Market
```

#### Collateralised Markets

Markets that are collateralised use the collateral under management first, instead of borrowing assets from the connected Vault.

```text
Given calculated odds are 3:1,
And the Vault has 10,000 tokens,
And the Market has 250 tokens,
And the runner being bet on has 0 existing bets
When a bet of 100 tokens is placed
Then the Vault lends 50 tokens to the Market
```

### Registry

The registry contract is a mapping of Vaults and Markets used by the protocol. This allows a single source of truth for calling applications and smart contracts. It also has the ability to only allow token holders to modify the contracts it registers.

| Network | Address |
| ------- | ------- |
| Arbitrum  | 0xa110D6Bd21c226285b18f91b1749eBc12007a7E7 |

### Oracle

The `MarketOracle.sol` contract allows authorised accounts to set results based on the Market ID and the Proposition ID. The results are either set from a python script `settle.py` in the event of a losing Proposition or by the front end should the user win and claim their profits. The market owner is responsible for providing a signed result after the event.

| Network | Address |
| ------- | ------- |
| Arbitrum  | 0x8D54e1319A50B715a13E1E1a86297fC039B7C949 |

## Configuration

See `/hardhat.config.ts` for Hardhat configuration. Some values are fetched from environment variables, see `.env.development` for local development environment variables and copy it into `.env` before changing the values.

## Deployment

Deployments for each network are defined in the `package.json` file. To deploy to a network, run the following command:  `yarn deploy:env_network`

eg: 

```bash
yarn deploy:prod_arbitrum
```

### Deployment to Goerli

### Deployment to Local

### Deployment to Arbitrum

```bash
yarn deploy:prod_arbitrum"
```

### Contract addresses

Deployed addresses are saved in `/contracts.json` for each network. This file should be committed so that addresses are managed by git.

## Hardhat Tasks

Tasks are located in the `/scripts/tasks` folder.
A Hardhat task allows for easy contract interaction from the command line. To run a contract task, run a command with the following structure:

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

```text
network is localhost
token address is 0x47A78de7a881CCa1a0f510efA2E520b447F707Bb
balance is 1 wei for address 0xA39560b08FAF6d8Cd2aAC286479D25E0ea70f510
```

## Running settle/scratch automated scripts

We've got automated scripts running in [utils.horse.link](https://cloud.digitalocean.com/droplets/335220617/graphs?i=7cba59&period=hour):
`ssh root@170.64.176.240`

We use private keys to log onto the droplet without a password, so if you get a reply about authorization or password get someone with access to add your public key to the droplet.


If you need to make changes to the scripts you can copy them across with scp to make sure they work: `scp scripts/*.ts root@170.64.176.240:contracts.horse.link/scripts/` and run the scripts manually like `npx ts-node scripts/settle.ts`.

To deploy changes, pull the latest changes on the server: `ssh root@170.64.176.240 'cd contracts.horse.link; git pull'` (it shouldn't make a difference if you do it in a single command like this or log in and then pull or even use the console in the DigitalOcean dashboard).  Use  `git pull -f` if you want to clear out any changes that have been made on the server or copied across.

The scripts are usually run with crontab. You can check the current settings with `crontab -l` on the droplet:
```text
0,10,20,30,40,50 * * * * cd /root/contracts.horse.link && npx ts-node scripts/settle.ts >> $HOME/logs/settle.log 2>&1
5,15,25,35,45,55 * * * * cd /root/contracts.horse.link && npx ts-node scripts/scratch.ts >> $HOME/logs/scratch.log 2>&1
```
This says to run `settle.ts` every 10 minutes, and to run scratch.ts also every 10 minutes but offset by 5 minutes.

You can update the crontab with `crontab -e`
