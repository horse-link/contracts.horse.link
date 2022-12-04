from web3 import Web3
import json

w3 = Web3(Web3.HTTPProvider(
    'https://eth-goerli.g.alchemy.com/v2/u5vVYvyI5qgU6UXgDlfImbo4UutLzhTH'))

f = open('../artifacts/contracts/Market.sol/Market.json')
data = json.load(f)


def load_market(address):
    with open('../artifacts/contracts/Market.sol/Market.json') as f:
        data = json.load(f)
        abi = data['abi']
        contract = w3.eth.contract(address=address, abi=abi)
        return contract


def get_inplay_count(contract):
    inplaycount = contract.functions.getInPlayCount().call()
    return inplaycount


def settle(contract, index):
    bet = contract.functions.getBetByIndex(index).call()
    print(bet)

    if bet[3] == False:
        # tx_hash = contract.functions.settle(index).transact()
        # tx_receipt = w3.eth.waitForTransactionReceipt(tx_hash)
        # return tx_receipt
        return '0x00'


contract = load_market('0xD7363dd9a520787d02C223d5f02D86a3e2697675')
count = get_inplay_count(contract)
print(count)


for i in range(count):
    tx_receipt = settle(contract, i)
    print(tx_receipt)

