// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

interface IFreeWillSwap {

    function getPriceEth(address, uint256) external view returns (uint256);

    function getPrice(address, address, uint256) external view returns (uint256);

}