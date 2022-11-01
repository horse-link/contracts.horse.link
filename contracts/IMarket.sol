// SPDX-License-Identifier: MIT
pragma solidity =0.8.10;

interface IMarket {
    function getFee() external view returns (uint8);
    function getTotalInPlay() external view returns (uint256);
    function getInPlayCount() external view returns (uint256);
    function getTotalExposure() external view returns (uint256);
    function getBetByIndex(uint256 index) external view returns (uint256, uint256, uint256, bool, address);
    function getOdds(int256 wager, int256 odds, bytes32 propositionId) external view returns (int256);
    function getOracleAddress() external view returns (address);
    function getPotentialPayout(bytes32 propositionId, uint256 wager, uint256 odds) external view returns (uint256);
    function getVaultAddress() external view returns (address);
    function back(bytes32 nonce, bytes32 propositionId, bytes32 marketId, uint256 wager, uint256 odds, uint256 close, uint256 end, bytes calldata signature) external returns (uint256);
    function settle(uint256 index, bool result, bytes calldata signature) external;
    function settleMarket(bytes32 propositionId, uint256 from, uint256 to, bytes32 marketId, bytes calldata signature) external;
}