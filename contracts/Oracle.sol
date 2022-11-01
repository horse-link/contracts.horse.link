// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import "./BokkyPooBahsDateTimeLibrary.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

struct Result {
    uint8[] results;
    uint256 timestamp;
}

struct Track {
    bytes32 name;
    bytes32 mnemonic;
    int8 timezone;
    address owner;
}

contract Oracle is Ownable {
    using BokkyPooBahsDateTimeLibrary for uint;
    uint256 public count;
    address public token;

    // change to the reward token
    mapping(address => uint256) public rewards;

    // mapping(bytes32 => mapping(uint256 => mapping(uint256 => mapping(uint256 => mapping(uint256 => uint256[]))))) public results;
    // track mnemonic, year, month, day, race number
    mapping(bytes32 => mapping(uint8 => mapping(uint8 => mapping(uint8 => mapping(uint8 => Result))))) public results;

    function getResult(bytes32 track, uint8 year, uint8 month, uint8 day, uint8 race, uint8 position) external view returns (uint8) {
        Result memory result = results[track][year][month][day][race];

        require(result.timestamp > 0, "Invalid request");
        require(result.results.length < position, "Invalid position");
        
        return result.results[position];
    }

    constructor(address _token) {
        token = _token;
    }

    function addResult(bytes32 mnemonic, uint8 year, uint8 month, uint8 day, uint8 race, uint8[] memory _results) public {
        require(year >= 1970, "Too far in the past");
        require(BokkyPooBahsDateTimeLibrary.isValidDate(year, month, day), "Invalid date");
        require(BokkyPooBahsDateTimeLibrary.timestampFromDate(year, month, day) < block.timestamp, "Cannot add results of future events");
        require(results[mnemonic][year][month][day][race].timestamp == 0, "Results have already added");
        require(_results.length <= 4, "Too many results");
        
        results[mnemonic][year][month][day][race] = Result(_results, block.timestamp);
        count++;
        rewards[msg.sender]++;

        emit ResultAdded(msg.sender, block.timestamp, mnemonic, year, month, day, race, _results.length);
    }

    function claim() public {
        require(rewards[msg.sender] > 0, "No rewards earned");
        IERC20(token).transferFrom(address(this), msg.sender, rewards[msg.sender]);
        rewards[msg.sender] = 0;
    }

    event ResultAdded(address indexed who, uint256 timestamp, bytes32 mnemonic, uint256 year, uint256 month, uint256 day, uint256 race, uint256 total);
}