import { BigNumberish, ethers } from "ethers";
// import { BigNumber, BigNumberish, ethers } from "ethers";
import * as dotenv from "dotenv";
import axios from "axios";
import * as fs from "fs";

type Signature = {
	v: BigNumberish;
	r: string;
	s: string;
};

const node = process.env.GOERLI_URL;
const provider = new ethers.JsonRpcProvider(node);

function main(args) {
	const name = args.name || "stranger";
	const greeting = "Hello " + name + "!";
	console.log(JSON.stringify([args, provider, greeting]));
	return { body: JSON.stringify([args, provider, greeting]) };
}

main({});
