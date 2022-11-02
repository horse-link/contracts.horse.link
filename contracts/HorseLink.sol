// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract HorseLink is ERC20 {
    constructor() ERC20("Horse Link", "HL") {
        _mint(msg.sender, 100_000_000 * 10**decimals());
    }
}
