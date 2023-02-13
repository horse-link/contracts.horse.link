#!python3
import math
from web3 import Web3
from dotenv import load_dotenv
from datetime import datetime
import json
import os
import requests

load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))

# https://thegraph.com/hosted-service/subgraph/horse-link/hl-protocol-goerli
bets_query = """
{
  bets(where: {createdAt_gt: %(createdAt_gt)s, settled: false},orderBy:createdAt) {
    id
    createdAt
    createdAtTx
    marketId
    marketAddress
  }
}
"""


def get_subgraph_bets_since(createdAt_gt):
    query = bets_query % {"createdAt_gt": createdAt_gt}
    response = requests.post(
        "https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-goerli",
        data=json.dumps({"query": query}),
    )
    data = json.loads(response.text)["data"]
    return data["bets"]


def hydrate_market_id(market_id):
    # Remove the '0x' prefix
    market_id = market_id[2:]

    # Convert hexadecimal to binary
    binary = bytes.fromhex(market_id)
    # Decode binary as ASCII
    market_string = binary.decode("ascii")
    print(f">{market_string}<")

    # Parse the market string
    id = market_string[0:11]
    date = int(market_string[0:6])
    location = market_string[6:9]
    race = int(market_string[9:11])
    # Return a dictionary with the hydrated market data
    result = {
        "id": str(id),
        "date": date,
        "location": location,
        "race": race
    }
    return result


def get_oracle():
    response = requests.get('https://alpha.horse.link/api/config')
    data = response.json()
    return data['addresses']['marketOracle']


def load_market(address, token):
    response = requests.get(
        f'https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/{token}Market.json')
    data = response.json()
    abi = data['abi']
    contract = web3.eth.contract(address=address, abi=abi)
    return contract


def load_oracle():

    address = get_oracle()

    response = requests.get(
        'https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/MarketOracle.json')
    data = response.json()
    abi = data['abi']
    contract = web3.eth.contract(address=address, abi=abi)
    return contract


def get_result(oracle, marketId):
    # id as byte array
    encoded = marketId.encode('utf-8')
    id = bytearray(encoded)

    result = oracle.functions.getResult(id).call()
    return result


def set_result(oracle, marketId, propositionId, signature) -> None:
    try:
        # Can be any account with funds
        account_from = {
            'private_key': os.getenv('SETTLE_PRIVATE_KEY'),
            'address': '0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1',
        }

        signature_tuple = [signature['v'], signature['r'], signature['s']]

        encoded = marketId.encode('utf-8')
        id = bytearray(encoded)

        encoded = propositionId.encode('utf-8')
        proposition_id = bytearray(encoded)

        tx = oracle.functions.setResult(id, proposition_id, signature_tuple).buildTransaction(
            {
                'from': account_from['address'],
                'nonce': web3.eth.get_transaction_count(account_from['address']),
            }
        )

        tx_create = web3.eth.account.sign_transaction(
            tx, account_from['private_key'])

        tx_hash = web3.eth.send_raw_transaction(tx_create.rawTransaction)
        tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)

        print(tx_receipt)
    except:
        print("An exception occurred")


def settle(market, index):
    # Can be any account with funds
    account_from = {
        'private_key': os.getenv('SETTLE_PRIVATE_KEY'),
        'address': '0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1',
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
    oracle = load_oracle()
    now = datetime.now().timestamp()
    print(f"Current Time: {now}")

    # Now less 2 hours
    close_time = math.floor(now) - 7200
    print(f"Using close time of {close_time}")

    bets = get_subgraph_bets_since(close_time)

    for bet in bets:
        # check if bet is settled via the api
        # hydrate
        hydrated_market = hydrate_market_id(bet['marketId'])
        id = hydrated_market["id"]

        # call api to get result
        response = requests.get(f'{id}')

        # check if result has been added to the oracle
        result = get_result(oracle, id)

        # If we have a result from the API and the oracle has not already added the result
        if response.status_code == 200 and result != b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
            print(f"Settling bet {bet[id]} for market {bet['marketAddress']}")

            tx_receipt = settle(market, i)
            print(tx_receipt)


if __name__ == '__main__':
    print('Starting settle script')
    main()
