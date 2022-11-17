// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./Erc4626Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


contract Vault is ERC4626Metadata, Ownable {

    //Mapping address => uint256
    mapping(address => uint256) public marketAllowance;
    address private _market;

    constructor(IERC20Metadata asset_)
    ERC4626Metadata(
        asset_
    ) 
    ERC20(
        string(abi.encodePacked("HL ", asset_.name())),
        string(abi.encodePacked("HL", asset_.symbol()))
    ) {}

    function setMarket(address market, uint256 max) public onlyOwner {
        require(_market == address(0), "setMarket: Market already set");
        _market = market;
        IERC20(asset()).approve(_market, max);
    }

    function getPerformance() external view returns (uint256) {
        return _getPerformance();
    }

    function _getPerformance() private view returns (uint256) {
        if (totalAssets() == 0) {
            return 0;
        }
        return totalSupply() * 100 / totalAssets();
    }

    function getMarket() external view returns (address) {
        return _market;
    }

}