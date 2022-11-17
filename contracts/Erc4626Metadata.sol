// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

abstract contract ERC4626Metadata is ERC4626 {

    constructor(IERC20Metadata asset_)
    ERC4626(
        asset_
    ) {} 

}