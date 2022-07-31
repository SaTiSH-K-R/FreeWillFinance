// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract fEther is ERC20 {

    address minter;
    
    modifier onlyMinter {
        require(msg.sender == minter, "fEther: FORBIDDEN");
        _;
    }

    constructor(address _minter) ERC20("fEther", "fETH") {
        minter = _minter;
    }

    function mint(address to, uint256 amount) public onlyMinter {
        _mint(to, amount);
    }

    function burn(address account, uint256 amount) public onlyMinter {
        _burn(account, amount);
    }
    
}