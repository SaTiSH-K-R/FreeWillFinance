// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

interface IFreeWillSwap {

    function getPriceEth(address) external view returns (uint256);

    function getPrice(address, address) external view returns (uint256);

}