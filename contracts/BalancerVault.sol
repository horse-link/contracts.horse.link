// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./ERC4626Metadata.sol";
import "./IMarket.sol";
import "./Vault.sol";
import "./IVault.sol";
// import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/math/Math.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract BalancerVault is Vault {

    // struct JoinPoolRequest {
    //     address[] assets,
    //     uint256[] maxAmountsIn,
    //     bytes userData,
    //     bool fromInternalBalance
    // }

    // struct ExitPoolRequest {
    //     address[] assets,
    //     uint256[] minAmountsOut,
    //     bytes userData,
    //     bool toInternalBalance
    // }

    address private immutable _pool;

    constructor(IERC20Metadata asset_, address pool) Vault(asset_) {
        require(
            address(pool) != address(0),
            "Pool address is invalid"
        );
        _pool = pool;
    }

}