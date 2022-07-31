// SPDX-License-Identifier: MIT
pragma solidity 0.8.14;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "./interfaces/fEtherInterface.sol";
import "./interfaces/fTokenInterface.sol";
import "./interfaces/IFreeWillSwap.sol";
import "./interfaces/IFreeWillToken.sol";


contract FreeWillStorage {

    struct Borrow {

        address borrowedToken;

        uint256 borrowedAmount;

        address[] collatoralTokensList;

        uint256 collatoralEther;

        mapping (address => uint256) collatoralAmounts;

        uint256 interestOwed;
        
    }

    struct BorrowEth {
        
        uint256 borrowedAmount;

        address[] collatoralTokensList;

        mapping (address => uint256) collatoralAmounts;

        uint256 interestOwed;
        
    }

    struct User {

        uint256 suppliedEther;

        uint256 unlockedEther;

        mapping (address => uint256) suppliedTokens;

        mapping (address => uint256) unlockedTokens;

        mapping (address => Borrow) borrows;

        BorrowEth ethBorrow;

        address[] borrowedTokenList;

        address[] suppliedTokenList;

        uint256 interestEarned;

        uint256 lastSupplyTimeStamp;

        uint256 lastBorrowTimeStamp;

    }

    mapping (address => User) users;

    mapping (address => address) public fTokenAddress;

    mapping (address => uint256) public tokenSupply;

    uint256 public ethSupply;

    address[] public allTokens;
    
    // Supply APY 4%
    uint public supplyInterestRate = 40;

    // Borrow APY 10%
    uint public borrowInterestRate = 100;

    // User can borrow 60% of thier collatoral value
    uint public collatoralFactor = 600;

}

contract FreeWill is Ownable, FreeWillStorage {

    address internal FUSD;
    fEtherInterface fEth;
    IFreeWillSwap fwSwap;
    IFreeWillToken fwt;


    constructor(address fEther, address _FUSD, IFreeWillSwap _fwSwap, IFreeWillToken _fwt) {
        fEth = fEtherInterface(fEther);
        FUSD = _FUSD;
        fwSwap = _fwSwap;
        fwt = _fwt;
    }

    function depositEth() public payable {
        address user = msg.sender;
        uint256 amount = msg.value;
        users[user].suppliedEther += amount;
        users[user].unlockedEther += amount;
        ethSupply += msg.value;
        fEth.mint(user, msg.value);
        updateInterestEarned(user);
    }

    function withdrawEth(uint256 amount) public {
        address user = msg.sender;
        require(users[user].unlockedEther >= amount, "FreeWill: Can't withdraw locked amount");
        users[user].suppliedEther -= amount;
        users[user].unlockedEther -= amount;
        ethSupply -= amount;
        fEth.burn(amount);
        payable(user).transfer(amount);
        updateInterestEarned(user);
    }

    function depositTokens(address token, uint256 amount) public {
        address user = msg.sender;
        IERC20(token).transferFrom(user, address(this), amount);
        users[user].suppliedTokens[token] += amount;
        users[user].unlockedTokens[token] += amount;
        tokenSupply[token] += amount;
        fTokenInterface ftoken = fTokenInterface(fTokenAddress[token]);
        ftoken.mint(user, amount);
        updateInterestEarned(user);
    }

    function withdrawTokens(address token, uint256 amount) public {
        address user = msg.sender;
        require(users[user].unlockedTokens[token] >= amount, "FreeWill: Can't withdraw locked amount");
        fTokenInterface ftoken = fTokenInterface(fTokenAddress[token]);
        ftoken.burn(user, amount);
        users[user].suppliedTokens[token] -= amount;
        tokenSupply[token] -= amount;
        IERC20(token).transfer(user, amount);
        updateInterestEarned(user);
    }

    function borrowEth(
        uint256 amount,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) public {
        require(ethSupply > amount, "FreeWill: Insufficient Supply");
        uint256 collatoralValue = getValue(tokens, amounts, 0);   
        uint256 ethPrice = fwSwap.getPriceEth(FUSD);
        uint256 ethValue = amount * ethPrice;
        require((collatoralValue * collatoralFactor) / 1000 >= ethValue, "FreeWill: Not enough collatoral");
        address user = msg.sender;
        ethSupply -= amount;
        users[user].ethBorrow.borrowedAmount += amount;
        for(uint i; i < tokens.length; i++) {
            require(users[user].unlockedTokens[tokens[i]] >= amounts[i], "FreeWill: Not enough tokens");
            users[user].ethBorrow.collatoralAmounts[tokens[i]] += amounts[i];
            users[user].unlockedTokens[tokens[i]] -= amounts[i];
            addCollatoralTokenForEth(user, tokens[i]);
        }
        payable(user).transfer(amount);
        updateInterestOwed(user);
    }

    function addCollatoralTokenForEth(address user, address collatoralToken) private {
        bool tokenExist;
        for(uint j; j < users[user].ethBorrow.collatoralTokensList.length; j++) {
            if(users[user].ethBorrow.collatoralTokensList[j] == collatoralToken) {
                tokenExist = true;
            }
        }
        if(!tokenExist) {
            users[user].ethBorrow.collatoralTokensList.push(collatoralToken);
        }
    }

    function borrowToken(
        address token,
        uint256 amount,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 ethAmount
    ) public {
        require(tokenSupply[token] > amount, "FreeWill: Insufficient token supply");
        uint256 collatoralValue = getValue(tokens, amounts, ethAmount);
        uint256 tokenPrice = fwSwap.getPrice(FUSD, token);
        uint256 tokenValue = amount * tokenPrice;
        require((collatoralValue * collatoralFactor) / 1000 >= tokenValue, "FreeWill: Not enough collatoral");
        tokenSupply[token] -= amount;
        address user = msg.sender;
        require(users[user].unlockedEther > ethAmount, "FreeWill: Not enough Ether");
        users[user].unlockedEther -= ethAmount;
        users[user].borrows[token].borrowedAmount += amount;
        for(uint i; i < tokens.length; i++) {
            require(users[user].unlockedTokens[tokens[i]] >= amounts[i], "FreeWill: Not enough tokens");
            users[user].borrows[token].collatoralAmounts[tokens[i]] += amounts[i];
            users[user].unlockedTokens[token] -= amounts[i];
            addCollatoralToken(user, token, tokens[i]);
        }
        IERC20(token).transfer(user, amount);
        updateInterestOwed(user);
    }

    // @param user: msg.sender
    // @param token: borrowing token
    // @param collatoralToken: collatoral token to be added to array
    function addCollatoralToken(address user, address token, address collatoralToken) private {
        bool tokenExist;
        for(uint j; j < users[user].borrows[token].collatoralTokensList.length; j++) {
            if(users[user].borrows[token].collatoralTokensList[j] == collatoralToken) {
                tokenExist = true;
            }
        }
        if(!tokenExist) {
            users[user].ethBorrow.collatoralTokensList.push(collatoralToken);
        }
    }

    function getValue(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 ethAmount
    ) internal view returns (uint256 value) {
        uint256 price;
        address fusd = FUSD;
        for(uint i; i < tokens.length; i++) {
            if(tokens[i] == fusd) {
                value += amounts[i];
            } else {
                price = fwSwap.getPrice(fusd, tokens[i]);
                value += amounts[i] * price;
            }
        }
        if(ethAmount > 0) {
            value += ethAmount * fwSwap.getPriceEth(fusd);
        }
    }

    function getUnlockedAmountsValue(address user) internal view returns (uint256 value) {
        address[] memory userTokens = users[user].suppliedTokenList;
        uint256 price;
        address fusd = FUSD;
        for(uint i; i < userTokens.length; i++) {
            if(userTokens[i] == fusd) {
                value += users[user].unlockedTokens[userTokens[i]];
            } else {
                price = fwSwap.getPrice(fusd, userTokens[i]);
                value += users[user].unlockedTokens[userTokens[i]] * price;
            }
        }
        uint256 ethPrice = fwSwap.getPriceEth(fusd);
        value += users[user].unlockedEther * ethPrice;
    }

    function addToken(address token, address fToken) public onlyOwner {
        address actualToken = fTokenInterface(fToken).actualToken();
        require(actualToken == token, "FreeWill: fToken contract not belongs to this token");
        allTokens.push(token);
    }

    function repayEth() public payable {
        address user = msg.sender;
        require(msg.value >= users[user].ethBorrow.borrowedAmount, "FreeWill: Pay full amount");
        IERC20(address(fwt)).transferFrom(user, address(this), users[user].ethBorrow.interestOwed);
        uint collatoralTokensLength = users[user].ethBorrow.collatoralTokensList.length;
        for(uint i; i < collatoralTokensLength; i++) {
            address tkn = users[user].ethBorrow.collatoralTokensList[i];
            users[user].unlockedTokens[tkn] += users[user].ethBorrow.collatoralAmounts[tkn];
            delete users[user].ethBorrow.collatoralAmounts[tkn];
        }
        delete users[user].ethBorrow;
    }

    function repayTokens(address token, uint256 amount) public {
        address user = msg.sender;
        uint256 borrowedAmount = users[user].borrows[token].borrowedAmount;
        require(amount >= borrowedAmount, "FreeWill: Pay full amount");
        IERC20(token).transferFrom(user, address(this), borrowedAmount);
        IERC20(address(fwt)).transferFrom(user, address(this), users[user].borrows[token].interestOwed);
        for(uint i; i < users[user].borrows[token].collatoralTokensList.length; i++) {
            address tkn = users[user].borrows[token].collatoralTokensList[i];
            users[user].unlockedTokens[tkn] += users[user].borrows[token].collatoralAmounts[tkn];
            delete users[user].borrows[token].collatoralAmounts[tkn];
        }
        users[user].unlockedEther += users[user].borrows[token].collatoralEther;
        delete users[user].borrows[token];
    }

    function adjustCollatoralsOfTokens(
        address token,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 ethAmount
    ) public {
        (uint256 oldEthAmount, address[] memory oldTokens, uint256[] memory oldAmounts) = getCollatoralsOfToken(token);
        require(
            getValue(tokens, amounts, ethAmount) >= getValue(oldTokens, oldAmounts, oldEthAmount),
            "FreeWill: New collatoral amounts should more or equal"
        );
        address user = msg.sender;
        for(uint i; i < tokens.length; i++) {
            if(amounts[i] > users[user].borrows[token].collatoralAmounts[tokens[i]]) {
                uint256 amountIncreased = amounts[i] - users[user].borrows[token].collatoralAmounts[tokens[i]];
                require(amountIncreased >= users[user].unlockedTokens[tokens[i]], "FreeWill: Insufficient tokens");
                users[user].unlockedTokens[tokens[i]] -= amountIncreased;
                users[user].borrows[token].collatoralAmounts[tokens[i]] += amountIncreased;
                addCollatoralToken(user, token, tokens[i]);
            } else {
                uint256 amountDecreased = users[user].borrows[token].collatoralAmounts[tokens[i]] - amounts[i];
                users[user].unlockedTokens[tokens[i]] += amountDecreased;
                users[user].borrows[token].collatoralAmounts[tokens[i]] -= amountDecreased;
            }
        }
        if(ethAmount > oldEthAmount) {
            uint256 amountIncreased = ethAmount - oldEthAmount;
            require(users[user].unlockedEther >= amountIncreased, "FreeWill: Insufficient ether");
            users[user].unlockedEther -= amountIncreased;
            users[user].borrows[token].collatoralEther += amountIncreased;
        } else {
            uint256 amountDecreased = oldEthAmount - ethAmount;
            users[user].unlockedEther += amountDecreased;
            users[user].borrows[token].collatoralEther -= amountDecreased;
        }
    }

    function adjustCollatoralsOfEth(address[] calldata tokens, uint256[] calldata amounts) public {
        (address[] memory oldTokens, uint256[] memory oldAmounts) = getCollatoralsOfEth();
        require(
            getValue(tokens, amounts, 0) >= getValue(oldTokens, oldAmounts, 0),
            "FreeWill: New collatoral amounts should more or equal"
        );
        address user = msg.sender;
        for(uint i; i < tokens.length; i++) {
            if(amounts[i] > users[user].ethBorrow.collatoralAmounts[tokens[i]]) {
                uint256 amountIncreased = amounts[i] - users[user].ethBorrow.collatoralAmounts[tokens[i]];
                require(amountIncreased >= users[user].unlockedTokens[tokens[i]], "FreeWill: Insufficient tokens");
                users[user].unlockedTokens[tokens[i]] -= amountIncreased;
                users[user].ethBorrow.collatoralAmounts[tokens[i]] += amountIncreased;
                addCollatoralTokenForEth(user, tokens[i]);
            } else {
                uint256 amountDecreased = users[user].ethBorrow.collatoralAmounts[tokens[i]] - amounts[i];
                users[user].unlockedTokens[tokens[i]] += amountDecreased;
                users[user].ethBorrow.collatoralAmounts[tokens[i]] -= amountDecreased;
            }
        }
    }

    function getCollatoralsOfToken(address token) public view returns (uint256, address[] memory, uint256[] memory) {
        address user = msg.sender;
        address[] memory tokens = users[user].borrows[token].collatoralTokensList;
        uint collatoralTokensLength = tokens.length;
        uint256[] memory amounts = new uint256[](collatoralTokensLength);
        for(uint i; i < collatoralTokensLength; i++) {
            address tkn = tokens[i];
            amounts[i] = users[user].borrows[token].collatoralAmounts[tkn];
        }
        uint256 ethAmount = users[user].borrows[token].collatoralEther;
        return (ethAmount, tokens, amounts);
    }

    function getCollatoralsOfEth() public view returns (address[] memory, uint256[] memory) {
        address user = msg.sender;
        address[] memory tokens = users[user].ethBorrow.collatoralTokensList;
        uint collatoralTokensLength = tokens.length;
        uint256[] memory amounts = new uint256[](collatoralTokensLength);
        for(uint i; i < collatoralTokensLength; i++) {
            address tkn = tokens[i];
            amounts[i] = users[user].ethBorrow.collatoralAmounts[tkn];
        }
        return (tokens, amounts);
    }

    function updateInterestEarned(address user) private {
        uint256 interestValue;
        uint256 interest;
        address fusd = FUSD;
        uint256 ethValue;
        uint256 ethAmount = users[user].suppliedEther;
        if(ethAmount > 0) {
            ethValue = ethAmount * fwSwap.getPriceEth(fusd);
        }
        uint256 tokensValue;
        for(uint i; i < users[user].suppliedTokenList.length; i++) {
            address token = users[user].suppliedTokenList[i];
            tokensValue += users[user].suppliedTokens[token] * fwSwap.getPrice(fusd, token);
        }
        interestValue = ((ethValue + tokensValue)
                   * (block.timestamp - users[user].lastSupplyTimeStamp)
                   * supplyInterestRate)
                   / (365 * 24 * 60 * 60 * 1000 * 1000);
        interest = interestValue / fwSwap.getPrice(fusd, address(fwt));
        users[user].interestEarned += interest;
        users[user].lastSupplyTimeStamp = block.timestamp;
    }

    function updateInterestOwed(address user) private {
        uint256 interestValue;
        uint256 interest;
        address fusd = FUSD;
        uint256 ethValue;
        uint256 ethAmount = users[user].ethBorrow.borrowedAmount;
        uint256 fwtPrice = fwSwap.getPrice(fusd, address(fwt));
        if(ethAmount > 0) {
            ethValue = ethAmount * fwSwap.getPriceEth(fusd);
            interestValue = (ethValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = interestValue / fwtPrice;
            users[user].ethBorrow.interestOwed += interest;
        }
        uint256 tokensValue;
        for(uint i; i < users[user].borrowedTokenList.length; i++) {
            address token = users[user].borrowedTokenList[i];
            tokensValue += users[user].borrows[token].borrowedAmount * fwSwap.getPrice(fusd, token);
            interestValue = (tokensValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = interestValue / fwtPrice;
            users[user].borrows[token].interestOwed += interest;
        }
        users[user].lastBorrowTimeStamp = block.timestamp;
    }

    function claimInterest() public returns (uint256) {
        address user = msg.sender;
        uint256 interest = users[user].interestEarned;
        fwt.mint(user, interest);
        return interest;
    }

}