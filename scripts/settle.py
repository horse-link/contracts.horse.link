from web3 import Web3
from dotenv import load_dotenv
import json
import os
import requests

load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))


def get_markets():
    response = requests.get("https://horse.link/api/config")
    data = response.json()
    return data['markets']


def load_market(address):
    with open('./artifacts/contracts/Market.sol/Market.json') as f:
        data = json.load(f)
        abi = data['abi']
        contract = web3.eth.contract(address=address, abi=abi)
        return contract


def get_count(contract):
    count = contract.functions.getCount().call()
    return count


def settle(contract, index):
    bet = contract.functions.getBetByIndex(index).call()
    print(bet)

    if bet[3] == False:
        account_from = {
            'private_key': os.getenv('PRIVATE_KEY'),
            'address': '0x155c21c846b68121ca59879B3CCB5194F5Ae115E',
        }

        tx = contract.functions.settle(index).buildTransaction(
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

    # settle each market
    for market in markets:
        contract = load_market(market['address'])
        count = get_count(contract)
        start = count - 50 if count > 50 else 0

        # settle last 50
        for i in range(start, count):
            print(f"Settling bet {i} for market {market['address']}")
            
            tx_receipt = settle(contract, i)
            print(tx_receipt)


if __name__ == "__main__":
    main()
