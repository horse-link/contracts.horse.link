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


def load_oracle():

    address = get_oracle()

    with open('./artifacts/contracts/MarketOracle.sol/MarketOracle.json') as f:
        data = json.load(f)
        abi = data['abi']
        contract = web3.eth.contract(address=address, abi=abi)
        return contract


def get_result(oracle, marketId):
    result = oracle.functions.getResult(marketId).call()
    return result


def set_result(oracle, marketId, propositionId, signature):
    account_from = {
        'private_key': os.getenv('PRIVATE_KEY'),
        'address': '0x155c21c846b68121ca59879B3CCB5194F5Ae115E',
    }

    tx = oracle.functions.setResult(marketId, propositionId, signature).buildTransaction(
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


def settle(index):
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
    market_addresses = get_markets()
    oracle = load_oracle()
    now = datetime.now().timestamp()
    print(f"Current Time: {now}")

    # settle each market
    for market_address in market_addresses:
        market = load_market(market_address['address'])
        count = market.functions.getCount().call()

        # settle each bet in reverse order
        for i in range(count - 1, 0, -1):
            bet = market.functions.getBetByIndex(i).call()

            # check if bet is less than 24 hours old
            if bet[2] > now - 60 * 60 * 24:

                # check if bet is settled via the api
                market_id = bet[5][0:11]
                mid = market_id.decode('ASCII')
                print(f"Market ID: {mid}")

                # check if bet is settled
                if bet[3] == False:

                    # check if result has been added to the oracle
                    result = get_result(oracle, market_id)

                    # call api to get result
                    response = requests.get(f'https://horse.link/api/markets/result/{mid}')

                    # If we have a result from the API and the oracle has not already added the result
                    if response.status_code == 200 and result == b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
                        # set result on oracle
                        print(f"Adding result for bet {i} to the oracle")

                        signature = response.json()['signature']
                        proposition_id = response.json()['winningPropositionId']
                        tx_receipt = set_result(
                            oracle, market_id, proposition_id, signature)

                        print(tx_receipt)

                    # If we have a result from the API and the oracle has already added the result
                    if response.status_code == 200 and result != b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00':
                        print(f"Settling bet {i} for market {market_address['address']}")

                        tx_receipt = settle(i)
                        print(tx_receipt)
                    else:
                        print(
                            f"Bet {i} for market {market_address['address']} already settled or result not added")
                else:
                    print(
                        f"Bet {i} for market {market_address['address']} already settled")

            else:
                print(f"Bet {i} for market {market_address['address']} is too old")
                break


if __name__ == '__main__':
    print('Starting settle script')
    main()
