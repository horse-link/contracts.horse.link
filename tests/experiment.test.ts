
import chai, { expect } from "chai";
import { NumberLiteralType } from "typescript";


describe("Experiment", () => {



    beforeEach(async () => {

    });

    it("experiment 1", async () => {

    });
});

type Proposition = {
    place: number,
    runner: number
}
/**
Proposition(1, 1) means that runner 1 is in place 1
A bet contains a number of propositions and an amount. The bet wins only if all propositions are true
This algorithm injects the bet, such that the maximum potential payout can be calculated
i.e for these bets:

Bet 1
Propositions: [(1, 1), (2, 2)]
Amount: 10

Bet 2
Propositions: [(1, 1)]
Amount: 10

Bet 3
Propositions: [(2, 2)]
Amount: 10

The maximum potential payout occurs if runner 1 is in place 1 and runner 2 is in place 2
Bet 1, 2 and 3 are all winners, and the total payout is 30

Another example:

Bet 1
Propositions: [(1, 1), (2, 2)]
Amount: 10
,  , ,,,,,,hhkkjhhhhhhhhhhhhhh
Bet 2
Propositions: [(2, 1)]
Amount: 10

Bet 3
Propositions: [(1, 2)]
Amount: 10


* 
 * 
 */

/*


class BetNode {
    public propositionId?: string;
    public proposition?: Proposition;
    public totalPotentialPayout: number;
    public branches: BetNode[];
    constructor(root: NodeRoot, proposition: Proposition) {
        this.proposition = proposition;
        this.totalPotentialPayout = 0;
        this.branches = [];
    }

    public injestBet(propositions: Proposition[], amount: number) {
        // For the first proposition,
        // If the proposition is one of the branches, add the amount to the totalPotentialPayout
        // If the proposition is not one of the branches, create a new branch with the proposition and recurse
        if (propositions.length === 0) {
            return;
        }
        const proposition = propositions[0];
        let branch = this.branches.find(
            branch => branch.proposition?.place === proposition.place && branch.proposition?.runner === proposition.runner
        );
        if (!branch) {
            branch = new BetNode(proposition);
            this.branches.push(branch);
        }
        // If this is the end of the propositions, deposit the amount here
        if (propositions.length === 1) {
            branch.addTotalPotentialPayout(amount);
        }

        

    }

    public addTotalPotentialPayout(amount: number) {
        this.totalPotentialPayout += amount;
    }

}



function makePropositionId(proposition: Proposition) {
    return `${proposition.entity}.${proposition.value}`;
}
function injestBet(propositions: Proposition[], potentialPayout: number) {


}
*/


