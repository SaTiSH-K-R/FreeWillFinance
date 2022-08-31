// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract fEther is ERC20 {

    address minter;
    address owner;
    
    modifier onlyMinter {
        require(msg.sender == minter, "fEther: FORBIDDEN");
        _;
    }

    modifier onlyOwner {
        require(msg.sender == owner, "fEther: FORBIDDEN");
        _;
    }

    constructor() ERC20("fEther", "fETH") {
        owner = msg.sender;
    }

    function mint(address to, uint256 amount) public onlyMinter {
        _mint(to, amount);
    }

    function burn(address account, uint256 amount) public onlyMinter {
        _burn(account, amount);
    }

    function setMinter(address _minter) public {
        minter = _minter;
    }
    
}