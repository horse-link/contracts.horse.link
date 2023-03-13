// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "../MarketCollateralised.sol";
import "../Market.sol";

abstract contract MarketCollateralisedLinear is MarketCollateralised {

    constructor(
        IVault vault,
        uint8 fee,
        uint8 timeoutDays,
        address oracle
    ) Market(vault, fee, timeoutDays, oracle) {
    }
}