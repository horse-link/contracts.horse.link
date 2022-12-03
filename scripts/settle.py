from web3 import Web3
import json

w3 = Web3(Web3.HTTPProvider('https://eth-goerli.g.alchemy.com/v2/u5vVYvyI5qgU6UXgDlfImbo4UutLzhTH'))

f = open('../artifacts/contracts/Market.sol/Market.json')
data = json.load(f)

with open('../artifacts/contracts/Market.sol/Market.json') as f:
    data = json.load(f)
    abi = data['abi']
    contract = w3.eth.contract(address='0xD7363dd9a520787d02C223d5f02D86a3e2697675', abi=abi)
    inplaycount = contract.functions.getInPlayCount().call()
    print(inplaycount)

