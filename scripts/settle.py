from web3 import Web3
from dotenv import load_dotenv
from datetime import datetime
import json
import os
import requests

load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))


def get_markets():
    response = requests.get('https://horse.link/api/config')
    data = response.json()
    return data['markets']


def get_oracle():
    response = requests.get('https://horse.link/api/config')
    data = response.json()
    return data['addresses']['marketOracle']


def load_market(address):
    with open('./artifacts/contracts/Market.sol/Market.json') as f:
        data = json.load(f)
        abi = data['abi']
        contract = web3.eth.contract(address=address, abi=abi)
        return contract


def load_oracle(address):
    with open('./artifacts/contracts/Oracle.sol/Oracle.json') as f:
        data = json.load(f)
        abi = data['abi']
        contract = web3.eth.contract(address=address, abi=abi)
        return contract


def get_count(contract):
    count = contract.functions.getCount().call()
    return count


def update_oracle(oracle, index):
    account_from = {
        'private_key': os.getenv('PRIVATE_KEY'),
        'address': '0x155c21c846b68121ca59879B3CCB5194F5Ae115E',
    }

    tx = oracle.functions.setResult(index).buildTransaction(
        {
            'from': account_from['address'],
            'nonce': web3.eth.get_transaction_count(account_from['address']),
        }
    )

    tx_create = web3.eth.account.sign_transaction(
        tx, account_from['private_key'])

    tx_hash = web3.eth.send_raw_transaction(tx_create.rawTransaction)
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    return tx_receipt


def settle(market, index):
    account_from = {
        'private_key': os.getenv('PRIVATE_KEY'),
        'address': '0x155c21c846b68121ca59879B3CCB5194F5Ae115E',
    }

    tx = market.functions.settle(index).buildTransaction(
        {
            'from': account_from['address'],
            'nonce': web3.eth.get_transaction_count(account_from['address']),
        }
    )

    tx_create = web3.eth.account.sign_transaction(
        tx, account_from['private_key'])

    tx_hash = web3.eth.send_raw_transaction(tx_create.rawTransaction)
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

    return tx_receipt


def main():
    # fetch registry contract address from the api
    markets = get_markets()
    # oracle = get_oracle()
    now = datetime.now().timestamp()
    print(f"Current Time: {now}")

    # settle each market
    for market in markets:
        market = load_market(market['address'])
        # oracle = load_oracle()
        count = get_count(contract)

        # settle each bet in reverse order
        for i in range(count - 1, 0, -1):
            bet = market.functions.getBetByIndex(i).call()

            if bet[2] > now - 60 * 60 * 2:

                # check if bet is settled via the api
                response = requests.get(
                    f'https://horse.link/api/markets/result/{bet[6]}')

                if response.status_code == 200 and bet[3] == False:
                    print(f"Settling bet {i} for market {market['address']}")

                    tx_receipt = settle(contract, i)
                    print(tx_receipt)
                else:
                    print(
                        f"Bet {i} for market {market['address']} already settled")
            else:
                print(f"Bet {i} for market {market['address']} is too old")
                break


if __name__ == '__main__':
    print('Starting settle script')
    main()