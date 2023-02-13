from web3 import Web3
from dotenv import load_dotenv
import time
import json
import os
import requests
import sys


load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))


def get_oracle():
    response = requests.get('https://alpha.horse.link/api/config')
    data = response.json()
    return data['addresses']['marketOracle']

def load_oracle():
    address = get_oracle()
    response = requests.get('https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/MarketOracle.json')
    data = response.json()
    abi = data['abi']
    contract = web3.eth.contract(address=address, abi=abi)
    return contract

def set_scratch(oracle, marketId, propositionId, odds, totalOdds, signature) -> None:
    try:
        # Can be any account with funds
        account_from = {
            'private_key': os.getenv('SETTLE_PRIVATE_KEY'),
            'address': '0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1',
        }

        print(signature)

        # Convert the signature to a tuple
        signature_tuple = [signature['v'], signature['r'], signature['s']]
        print("***** Signature tuple: ", signature_tuple)

        encodedProposition = propositionId.encode('utf-8')
        proposition_id = bytearray(encodedProposition)
        encodedMarket = marketId.encode('utf-8')
        
        market_id = bytearray(encodedMarket)

        # remove the first 2 characters of the market_id and proposition_id
        #market_id = market_id[2:]
        #proposition_id = proposition_id[2:]

        print(market_id)
        print(proposition_id)
        print(odds)
        
        tx = oracle.functions.setScratchedResult(market_id, proposition_id, int(odds), int(totalOdds), signature_tuple).buildTransaction(
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
        #output the error
        print(sys.exc_info())

def hydrate_market_id(market_id):
    # Remove the '0x' prefix
    market_id = market_id[2:]
    
    # Convert hexadecimal to binary
    binary = bytes.fromhex(market_id)
    # Decode binary as ASCII
    market_string = binary.decode("ascii")
 
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


def get_subgraph_bets_since(createdAt_gt):
    # We may want to generate the schema locally with:
    # gql-cli 'https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-goerli' --print-schema > schema.graphql

    # From https://thegraph.com/hosted-service/subgraph/horse-link/hl-protocol-goerli
    bets_query = """
    {
      bets(where: {createdAt_gt: %(createdAt_gt)s},orderBy:createdAt, first: 1000) {
        id
        createdAt
        createdAtTx
        marketId
      }
    }
    """
    query = bets_query % {"createdAt_gt": createdAt_gt}
    print(query)
    response = requests.post(
        "https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-goerli",
        data=json.dumps({"query": query}),
    )
    data = json.loads(response.text)["data"]
    return data["bets"]


def main():
    print("Main")
  
    try:
      with open("state.json", "r") as state_file:
        state = json.load(state_file)
    except FileNotFoundError:
      state = {"last_run": 0, "watch_list": [], "processed_items": []}
    oracle = load_oracle()
    print("Loaded")
    print(f"Watch list contains {len(state['watch_list'])} races")

    # Fetch new bets from subgraph
    last_run = int(state.get("last_run", 0))
    this_run = int(time.time())
    bets = get_subgraph_bets_since(last_run)
    print(f"Found {len(bets)} new bets")
    new_markets_count = 0
    for bet in bets:
      market_id = bet.get("marketId")
      if market_id not in state.get("watch_list", []):
        state["watch_list"].append(market_id)
        new_markets_count += 1

    print(f"Added {new_markets_count} new markets to watch list")
        
    # For each market in the watch list, fetch the race details
    processed_items = [] # array of propositions that have already been sent to the Oracle contract
    for market_id in state.get("watch_list", []):
      # hydrate market ID
      hydrated_market = hydrate_market_id(market_id)
      location = hydrated_market["location"]
      race = hydrated_market["race"]
      id = hydrated_market["id"]

      print(f"Processing race {location} {race}")
      market_result_url = "https://alpha.horse.link/api/bets/sign/" + id
      print(market_result_url)
      market_response = requests.get(market_result_url)
      market_data = json.loads(market_response.text)
      
      
      # Process scratched runners
      runners = market_data.get("scratchedRunners")
      if runners is None:
        print("No scratched runners")
        continue
      print(f"Found {len(runners)} scratched runners")

      for runner in runners:

        print("Processing scratched runner")
        print(market_data)
        proposition_id = runner["b16propositionId"]
        # If not already processed,
        if proposition_id not in processed_items:
          # Send this proposition to Oracle contract
          print(f"Sending proposition {proposition_id} to Oracle contract")
          odds = runner["odds"] * 1000000
          totalOdds = int(runner["totalOdds"])
          signature = runner["signature"]
          print(f"set_scratch(oracle, {proposition_id}, {market_id}, {odds}, {totalOdds}, {signature}")
          set_scratch(oracle, proposition_id, market_id, odds, totalOdds, signature)
          print("Sent.")

          # Add to processed_items
          processed_items.append(proposition_id)

      if market_data.get("status") == "closed":
        state["watch_list"].remove(market_id)

      state["last_run"] = this_run

    print("Saving state")
    with open("state.json", "w") as state_file:
      json.dump(state, state_file)
    print("Done")

if __name__ == "__main__":
    print(f"Starting {__file__} script at {int(time.time())}")
    main()
