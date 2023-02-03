from web3 import Web3
import time
import json
import os
import requests
import math

node = os.getenv("GOERLI_URL")
web3 = Web3(Web3.HTTPProvider(node))

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

def hydrate_market_id(market_id):
    # Remove the '0x' prefix
    market_id = market_id[2:]
    # Convert hexadecimal to binary
    binary = bytes.fromhex(market_id)
    # Decode binary as ASCII
    market_string = binary.decode("ascii")
    date = int(market_string[0:6])
    location = market_string[6:9]
    race = int(market_string[9:11])
    # Return a dictionary with the hydrated market data
    result = {
        "date": date,
        "location": location,
        "race": race
    }
    return result


def get_subgraph_bets_since(createdAt_gt):
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
      print(f"Processing race {location} {race}")
      market_url = f"https://horse.link/api/runners/{location}/{race}/win"
      market_response = requests.get(market_url)
      # if 404,
      if market_response.status_code != 200:
        # remove from watch list
        print(f"Removing {market_id} from watch list")
        state["watch_list"].remove(market_id)
        continue
      market_data = json.loads(market_response.text).get("data", {})

      # Iterate through runners looking for scratches
      runners = market_data.get("runners");
      for runner in runners:
        if (runner.get("status") == "LateScratched"):
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
