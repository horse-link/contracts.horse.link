#!python3
from web3 import Web3
# from dotenv import load_dotenv
import requests
import json

# load_dotenv()

node = 'https://arb-mainnet.g.alchemy.com/v2/u_9j6rzbnHJPPHygii6HvvOyDs9J0x6G'
web3 = Web3(Web3.HTTPProvider(node))


# https://thegraph.com/hosted-service/subgraph/horse-link/hl-protocol-goerli
bets_query = """
{
  bets(where: {settled: false},orderBy:id) {
    id
    createdAt
    payout
  }
}
"""

def get_subgraph_bets():
    # Add content type application json
    response = requests.post(
        "https://api.thegraph.com/subgraphs/name/horse-link/hl-protocol-arbitrum",
        data=json.dumps({"query": bets_query}),
        headers={'Content-Type': 'application/json'}
    )
    print(response.text)
    data = json.loads(response.text)["data"]
    return data["bets"]



def main():
    count = 0
    total = 0
    bets = get_subgraph_bets()

    for bet in bets:
        print(f"Bet {bet['id']} is not settled! {bet['payout']}")
        count += 1
        total += int(bet['payout'])
        # bets.append(bet)

    print("Results:")
    print(f"Total: {total}")
    print(f"Count: {count}")


if __name__ == '__main__':
    print('Checking results')
    main()
