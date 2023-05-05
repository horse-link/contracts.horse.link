// SPDX-License-Identifier: MIT
pragma solidity =0.8.15;

import "./ERC4626Metadata.sol";
import "./IMarket.sol";
import "./Vault.sol";

import "@balancer-labs/v2-interfaces/contracts/vault/IVault.sol";

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

    IVault private constant vault = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
    address private _vault;
    bytes private immutable _poolId;

    constructor(IERC20Metadata asset_, address vault) Vault(asset_) {
        require(
            address(pool) != address(0),
            "Pool address is invalid"
        );

        // Balancer the pool is the vault 
        _vault = vault;
        _poolId = 0x64541216bafffeec8ea535bb71fbc927831d0595000100000000000000000002; // tri pool, wbtc usdc weth
    }

    function join() external {
        (IERC20[] memory tokens, , ) = vault.getPoolTokens(poolId);

        // Use BalancerErrors to validate input
        _require(amountsIn.length == tokens.length, Errors.INPUT_LENGTH_MISMATCH);

        // Encode the userData for a multi-token join
        bytes memory userData = abi.encode(WeightedPoolUserData.JoinKind.EXACT_TOKENS_IN_FOR_BPT_OUT, amountsIn, minBptAmountOut);

        IVault.JoinPoolRequest memory request = IVault.JoinPoolRequest({
            assets: _asIAsset(tokens),
            maxAmountsIn: amountsIn,
            userData: userData,
            fromInternalBalance: false
        });

        // Call the Vault to join the pool
        vault.joinPool(poolId, sender, recipient, request);
    }

    function lpBalance() external view returns (uint256) {
        return IERC20(asset()).balanceOf(_self);
    }
}