import chai, { expect } from "chai";
import { solidity } from "ethereum-waffle";
import { hydrateMarketId } from "../scripts/settle";

chai.use(solidity);

describe("settle script", () => {
	describe("hydrateMarketId", () => {
		it("should produce the correct results", () => {
			const exampleResults = {
				"0x30313933393446554e31310000000000": {
					id: "019394FUN11",
					date: 19394,
					location: "FUN",
					race: 11
				},
				"0x30313933393749505330370000000000": {
					id: "019397IPS07",
					date: 19397,
					location: "IPS",
					race: 7
				}
			};
			Object.keys(exampleResults).forEach((marketId) => {
				expect(hydrateMarketId(marketId)).to.deep.equal(
					exampleResults[marketId]
				);
			});
		});
	});
});
