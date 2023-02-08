"use strict";
exports.__esModule = true;
var ethers_1 = require("ethers");
var node = process.env.GOERLI_URL;
var provider = new ethers_1.ethers.JsonRpcProvider(node);
function main(args) {
    var name = args.name || 'stranger';
    var greeting = 'Hello ' + name + '!';
    console.log(JSON.stringify([args, provider, greeting]));
    return { "body": JSON.stringify([args, provider, greeting]) };
}
main({});
