import { expect } from "chai";

type BetBucket = {
	proposition: string[];
	total: number;
};

class BetProcessor {
	public betBuckets: BetBucket[];
	public maxPayout: number;
	public maxBucket: BetBucket;
	constructor() {
		this.betBuckets = [];
		this.maxPayout = 0;
	}

	public injestBet(proposition: string[], amount: number) {
		// Search bet buckets for applicable bucket, taking wildcards into account
		// If no perfect match found, create new bucket
		// Add amount to buckets totals
		const matchingBucket = this.findMatchingBucket(proposition);
		if (!matchingBucket) {
			this.betBuckets.push({
				proposition,
				total: 0
			});
		}
		const buckets = this.findApplicableBuckets(proposition);
		buckets.forEach((bucket) => {
			bucket.total += amount;
			if (bucket.total > this.maxPayout) {
				this.maxPayout = bucket.total;
				this.maxBucket = bucket;
			}
		});
	}

	public findMatchingBucket(proposition: string[]): BetBucket {
		const result = this.betBuckets.find((bucket) => {
			return this.isMatchingBucket(bucket, proposition);
		});
		return result;
	}

	public isMatchingBucket(
		bucket: BetBucket,
		newProposition: string[]
	): boolean {
		// True if the bucket is an exact match
		const result = bucket.proposition.every((value, idx) => {
			return value === newProposition[idx];
		});
		return result;
	}

	public findApplicableBuckets(proposition: string[]): BetBucket[] {
		// Search bet buckets for applicable bucket, taking wildcards into account
		// If no perfect match found, create new bucket
		const result = this.betBuckets.filter((bucket) => {
			return this.isBucketApplicable(bucket, proposition);
		});
		return result;
	}

	// Does this bucket represent a bet that would could result in a payout for this proposition?
	public isBucketApplicable(
		bucket: BetBucket,
		newProposition: string[]
	): boolean {
		// These values have to be in the same order or the bucket is not applicable
		const samePositionValues = newProposition.filter(
			(value, idx) => value !== "*"
		);
		const result = newProposition.every((newValue, idx) => {
			if (
				samePositionValues.includes(newValue) && // If this value needs to be in the same position
				bucket.proposition.includes(newValue) && // And the bucket includes this value
				bucket.proposition[idx] !== newValue
			) {
				// And the bucket does not have this value in the same position
				return false;
			}
			if (bucket.proposition[idx] === "*" || newValue === "*") {
				return true;
			}
			if (bucket.proposition[idx] === newValue) {
				return true;
			}
			return false;
		});
		return result;
	}
}

describe.only("Experiment", () => {
	it("should work", () => {
		const betProcessor = new BetProcessor();
		betProcessor.injestBet(["a", "*", "*"], 1); //Runner A to come first
		expect(betProcessor.maxPayout).to.equal(1); //Only one bet so far

		betProcessor.injestBet(["a", "b", "*"], 2); //Runner A to come first, Runner B to come second
		expect(betProcessor.maxPayout).to.equal(3); //Both bets could win

		betProcessor.injestBet(["*", "b", "*"], 4); //Runner B to come second
		expect(betProcessor.maxPayout).to.equal(7); //All bets could win

		betProcessor.injestBet(["b", "*", "a"], 8); //Runner B to come second, Runner A to come third
		expect(betProcessor.maxPayout).to.equal(8); //No other bets could win

		betProcessor.injestBet(["a", "b", "c"], 16); //Runner A to come first, Runner B to come second, Runner C to come third
		expect(betProcessor.maxPayout).to.equal(23); //7 + 16 = 23
	});
});
