from web3 import Web3

w3 = Web3(Web3.HTTPProvider('https://eth-goerli.g.alchemy.com/v2/u5vVYvyI5qgU6UXgDlfImbo4UutLzhTH'))

greeter = w3.eth.contract(
    address=,
    abi=abi
)