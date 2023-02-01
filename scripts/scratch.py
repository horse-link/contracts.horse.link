from web3 import Web3
from time import time
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


def get_subgraph_bets_since(createdAt_gt):
    query = bets_query % {"createdAt_gt": createdAt_gt}
    response = requests.post(
        "https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-goerli",
        data=json.dumps({"query": query}),
    )
    data = json.loads(response.text)["data"]
    return data["bets"]


def main():
    # Fetch new bets from subgraph

    # Make sure this matches the poll interval
    # TODO: make sure this time matches the time on the subgraph server
    one_minute_ago = math.floor(time()) - 60

    # WIP
    one_minute_ago = 1675222944
    print(f"WIP: using current time of {one_minute_ago} to guarantee results")

    bets = get_subgraph_bets_since(one_minute_ago)

    market_ids = set([bet["marketId"] for bet in bets])
    # oracle = load_oracle()

    #
    # update odds for each market
    for market_id in market_ids:
        print("TODO: recalculate odds for market", market_id)


if __name__ == "__main__":
    print("Starting scratch script")
    main()
