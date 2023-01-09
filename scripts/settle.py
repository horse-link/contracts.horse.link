from web3 import Web3
from dotenv import load_dotenv
from datetime import datetime
import json
import os
import requests


load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))

empty_array = b'\x00' * 16

def get_markets():
    response = requests.get('https://horse.link/api/config')
    data = response.json()
    return data['markets']


def get_oracle() -> str:
    response = requests.get('https://horse.link/api/config')
    data = response.json()
    return data['addresses']['marketOracle']


def load_market(address: str):
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


def get_count(contract) -> int:
    count = contract.functions.getCount().call()
    return count


def get_result(oracle, marketId):
    result = oracle.functions.getResult(marketId).call()
    return result


def check_result(oracle, marketId, propositionId) -> bool:
    result = oracle.functions.checkResult(marketId, propositionId).call()
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


def update_market_oracle(market_address, oracle):
    now = datetime.now().timestamp()
    print(f"Current Time: {now}")

    market = load_market(market_address)
    count = get_count(market)

    # update each bet in reverse order
    for i in range(count - 1, 0, -1):
        try:
            bet = market.functions.getBetByIndex(i).call()

            # check if bet is less than 2 hours old
            if bet[2] > now - 60 * 60 * 24 and bet[3] == False:

                # check if bet has a result
                market_id = bet[5][0:11]
                mid = market_id.decode('ASCII')
                print(f"Market ID: {mid}")

                # Note: this url will change to the results endpoint
                response = requests.get(
                    f'https://horse.link/api/bets/sign/{mid}')

                result = response.json()

                # check if the bet has a result from the api
                if response.status_code == 200 and result.get('winningPropositionId') is not None:

                    oracle_result = get_result(oracle, market_id)
                    
                    # check if the result is already set on the oracle
                    if oracle_result == empty_array:
                        # set result on oracle
                        print(
                            f"Setting result for market {market_address} to the oracle")

                        signature = response.json()['marketOracleResultSig']
                        proposition_id = response.json()['winningPropositionId']

                        tx_receipt = set_result(
                            oracle, market_id, proposition_id, signature)

                        print(tx_receipt)

            else:
                print(
                    f"Bet {i} for market {market_address} is too old or already settled")
                break
        except Exception as e:
            print(e)


def settle_market(market_address, oracle):
    print(f"Settling market {market_address}")
    now = datetime.now().timestamp()
    print(f"Current Time: {now}")

    market = load_market(market_address)
    count = get_count(market)
    
    # settle each bet in reverse order
    for i in range(count - 1, 0, -1):
        try:
            bet = market.functions.getBetByIndex(i).call()

            # check if is ready to
            if bet[2] > now - 60 * 60 * 24 and bet[3] == False:

                # check if bet has a result
                market_id = bet[5][0:11]
                mid = market_id.decode('ASCII')
                print(f"Market ID: {mid}")

                oracle_result = get_result(oracle, market_id)
                    
                if oracle_result != empty_array:
                    print(f"Settling bet {i} for market {market_address}")

                    tx_receipt = settle(market, i)
                    print(tx_receipt)

            else:
                print(
                    f"Bet {i} for market {market_address} is too old or already settled")
                break
        except Exception as e:
            print(e)


def main():
    # fetch registry contract address from the api
    market_addresses = get_markets()
    oracle = load_oracle()

    # settle each market
    for market_address in market_addresses:
        update_market_oracle(market_address['address'], oracle)
        settle_market(market_address['address'], oracle)


if __name__ == '__main__':
    print('Starting settle script')
    main()
