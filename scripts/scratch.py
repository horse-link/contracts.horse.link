from web3 import Web3
from dotenv import load_dotenv
import time
import json
import os
import requests
import math


load_dotenv()

node = os.getenv('GOERLI_URL')
web3 = Web3(Web3.HTTPProvider(node))

def get_oracle():
    response = requests.get('https://horse.link/api/config')
    data = response.json()
    return data['addresses']['marketOracle']

def load_oracle():
    address = get_oracle()
    response = requests.get('https://raw.githubusercontent.com/horse-link/contracts.horse.link/main/deployments/goerli/MarketOracle.json')
    data = response.json()
    abi = data['abi']
    contract = web3.eth.contract(address=address, abi=abi)
    return contract

def set_scratch(oracle, marketId, propositionId, odds, signature) -> None:
    try:
        # Can be any account with funds
        account_from = {
            'private_key': os.getenv('SETTLE_PRIVATE_KEY'),
            'address': '0xF33b9A4efA380Df3B435f755DD2C2AF7fE53C2d1',
        }

        signature_tuple = [signature['v'], signature['r'], signature['s']]

        encoded=propositionId.encode('utf-8')
        proposition_id=bytearray(encoded)

        tx = oracle.functions.setScratchedResult(marketId, proposition_id, odds, 0, signature_tuple).buildTransaction(
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

def hydrate_market_id(market_id):
    # Remove the '0x' prefix
    market_id = market_id[2:]
    
    # Convert hexadecimal to binary
    binary = bytes.fromhex(market_id)
    # Decode binary as ASCII
    market_string = binary.decode("ascii")
    print(f">{market_string}<")
 
    # Parse the market string
    date = int(market_string[0:6])
    location = market_string[6:9]
    race = int(market_string[9:11])
    # Return a dictionary with the hydrated market data
    result = {
        "id": str(market_string),
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
      bets(where: {createdAt_gt: %(createdAt_gt)s},orderBy:createdAt) {
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
    print("Main");
    try:
      with open("state.json", "r") as state_file:
        state = json.load(state_file)
    except FileNotFoundError:
      state = {"last_run": 0, "watch_list": [], "processed_items": []}
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
      # hydrate
      hydrated_market = hydrate_market_id(market_id)
      location = hydrated_market["location"]
      race = hydrated_market["race"]
      id = hydrated_market["id"]
      print(f"Processing race {location} {race}")
      #market_url = f"https://horse.link/api/runners/{location}/{race}/win"
      market_result_url = "https://horse.link/api/bets/sign/" + id
      market_result_url2 = "https://horse.link/api/bets/sign/019390SOU08"
      print(f">{market_result_url}<")
      print(f">{market_result_url2}<")
      # Lengths the same?
      if (len(market_result_url) != len(market_result_url2)):
        print("NOT EQUAL LENGTH")
        print(f"Length 1 is {len(market_result_url)}")
        print(f"Length 2 is {len(market_result_url2)}")
      if (market_result_url == market_result_url2):
        print("EQUAL")
      else:
        print("NOT EQUAL")
      market_response = requests.get(market_result_url)
      print(market_response)
      print(market_response.text)
      # if 404,
      #if market_response.status_code != 200:
      #  # remove from watch list
      #  print(f"Removing {market_id} from watch list")
      #  state["watch_list"].remove(market_id)
      #  continue

      market_data = json.loads(market_response.text)
      print(market_data)
      if not market_data["marketResultAdded"]:
        print(f"Market result for {location} {race} not added yet")
        continue

      # Iterate through runners looking for scratches
      print(market_data)
      runners = market_data.get("scratched");
      for runner in runners:
        print(f"Processing scratched runner {runner['name']}")
        proposition_id = runner["proposition_id"]
        # If not already processed,
        if proposition_id not in processed_items:
          # Send this proposition to Oracle contract
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
