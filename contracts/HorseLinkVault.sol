// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Erc4626Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";


abstract contract HorseLinkVault is ERC4626Metadata {

    constructor(IERC20Metadata asset_)
    ERC20(
        string(abi.encodePacked("HL ", asset_.name())),
        string(abi.encodePacked("HL", asset_.symbol()))
    ) {

    } 

}