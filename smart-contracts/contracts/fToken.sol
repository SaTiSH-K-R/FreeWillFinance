// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract fToken is ERC20, AccessControl {

    address minter;

    address public actualToken;
    
    modifier onlyMinter {
        require(msg.sender == minter, "fEther: FORBIDDEN");
        _;
    }

    constructor(
        string memory _tokenName,
        string memory _symbol,
        address _actualToken,
        address _minter
    ) ERC20(_tokenName, _symbol) {
        actualToken = _actualToken;
        minter = _minter;
    }

    function mint(address to, uint256 amount) public onlyMinter {
        _mint(to, amount);
    }

    function burn(address account, uint256 amount) public onlyMinter {
        _burn(account, amount);
    }
    
}