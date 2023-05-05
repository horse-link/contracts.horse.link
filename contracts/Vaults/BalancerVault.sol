// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "../IMarket.sol";
import "../Vault.sol";
import "../IVault.sol";
import "../IDefiVault.sol";

// import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/utils/math/Math.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract BalancerVault is Vault, IDefiVault {

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

    bytes private _pool;

    constructor(IERC20Metadata asset_, bytes memory pool) Vault(asset_) {
        _pool = pool; // 0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002
    }

    function join() external {
//         joinPool(
//             bytes32 poolId,
//             address sender,
//             address recipient,
//             JoinPoolRequest request
// )

    }

    function exit() external {

    }

    function rebalance() external {

    }

    function getLPTokens() external view returns (uint256) {
        return IERC20(_pool).balanceOf(_self);
    }
}