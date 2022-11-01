// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

// Horse.Link oracle interface
interface IHorseOracle {
    function getResult(bytes32 track, uint8 year, uint8 month, uint8 day, uint8 race, uint8 position) external returns (uint8);
}