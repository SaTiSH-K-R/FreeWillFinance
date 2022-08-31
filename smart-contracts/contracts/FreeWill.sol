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

    address[] internal allTokens;
    
    // Supply APY 15%
    uint public supplyInterestRate = 150;

    // Borrow APY 30%
    uint public borrowInterestRate = 300;

    // User can borrow 60% of thier collatoral value
    uint public collatoralFactor = 600;

}

contract FreeWill is Ownable, FreeWillStorage {

    address internal FUSD;
    fEtherInterface fEth;
    IFreeWillSwap fwSwap;
    IFreeWillToken fwt;

    event EthDeposit(address indexed user, uint256 amount);
    event EthWithdraw(address indexed user, uint256 amount);
    event TokenDeposit(address indexed user, address indexed token, uint256 amount);
    event TokenWithdraw(address indexed user, address indexed token, uint256 amount);
    event BorrowEther(address indexed user, uint256 amount);
    event RepayEther(address indexed user, uint256 amount);
    event BorrowToken(address indexed user, address indexed token, uint256 amount);
    event RepayToken(address indexed user, address indexed token, uint256 amount);
    event ClaimInterest(address indexed user, uint256 interest);

    constructor(address fEther, address _FUSD, IFreeWillSwap _fwSwap, IFreeWillToken _fwt) {
        fEth = fEtherInterface(fEther);
        FUSD = _FUSD;
        fwSwap = _fwSwap;
        fwt = _fwt;
    }

    function getAllTokens() public view returns (address[] memory _allTokens) {
        _allTokens = allTokens;
    }

    function getBalanceOfTokenSupplied(address user, address token) public view returns (uint256 balance) {
        balance = users[user].suppliedTokens[token];
    }

    function getBalanceOfEthSupplied(address user) public view returns (uint256 balance) {
        balance = users[user].suppliedEther;
    }

    function getBalanceOfEthBorrowed(address user) public view returns (uint256 balance) {
        balance = users[user].ethBorrow.borrowedAmount;
    }

    function getBalanceOfTokenBorrowed(address user, address token) public view returns (uint256 balance) {
        balance = users[user].borrows[token].borrowedAmount;
    }

    function getUnlockedEthAmount(address user) public view returns (uint256 amount) {
        amount = users[user].unlockedEther;
    }

    function getUnlockedTokenAmount(address user, address token) public view returns (uint256 amount) {
        amount = users[user].unlockedTokens[token];
    }

    function getInterestEarned() public view returns (uint256 interest) {
        uint256 interestValue;
        address fusd = FUSD;
        address user = msg.sender;
        uint256 ethValue;
        uint256 ethAmount = users[user].suppliedEther;
        if(ethAmount > 0) {
            ethValue = fwSwap.getPriceEth(fusd, ethAmount);
        }
        uint256 tokensValue;
        for(uint i; i < users[user].suppliedTokenList.length; i++) {
            address token = users[user].suppliedTokenList[i];
            uint256 amount = users[user].suppliedTokens[token];
            if(amount == 0) {
                continue;
            }
            tokensValue += fwSwap.getPrice(fusd, token, amount);
        }
        interestValue = ((ethValue + tokensValue)
                   * (block.timestamp - users[user].lastSupplyTimeStamp)
                   * supplyInterestRate)
                   / (365 * 24 * 60 * 60 * 1000 * 1000);
        if(interestValue > 0) {
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
        }
        interest += users[user].interestEarned;
    }

    function getInterestOwedEth() public view returns (uint256 interest) {
        uint256 interestValue;
        address fusd = FUSD;
        address user = msg.sender;
        uint256 ethValue;
        uint256 ethAmount = users[user].ethBorrow.borrowedAmount;
        if(ethAmount > 0) {
            ethValue = fwSwap.getPriceEth(fusd, ethAmount);
            interestValue = (ethValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
        }
        interest += users[user].ethBorrow.interestOwed;
        
    }

    function getInterestOwed(address token) public view returns (uint256 interest) {
        uint256 interestValue;
        uint256 tokensValue;
        address fusd = FUSD;
        address user = msg.sender;
        uint256 amount = users[user].borrows[token].borrowedAmount;
        if(amount > 0) {
            tokensValue = fwSwap.getPrice(fusd, token, amount);
            interestValue = (tokensValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
            
        }
        interest += users[user].borrows[token].interestOwed;
    }

    function depositEth() public payable {
        address user = msg.sender;
        uint256 amount = msg.value;
        updateInterestEarned(user);
        users[user].suppliedEther += amount;
        users[user].unlockedEther += amount;
        ethSupply += msg.value;
        fEth.mint(user, msg.value);
        emit EthDeposit(user, amount);
    }

    function withdrawEth(uint256 amount) public {
        address user = msg.sender;
        require(users[user].unlockedEther >= amount, "FreeWill: Can't withdraw locked amount");
        updateInterestEarned(user);
        users[user].suppliedEther -= amount;
        users[user].unlockedEther -= amount;
        ethSupply -= amount;
        fEth.burn(user,amount);
        payable(user).transfer(amount);
        emit EthWithdraw(user, amount);
    }

    function depositTokens(address token, uint256 amount) public {
        address user = msg.sender;
        updateInterestEarned(user);
        IERC20(token).transferFrom(user, address(this), amount);
        users[user].suppliedTokens[token] += amount;
        users[user].unlockedTokens[token] += amount;
        tokenSupply[token] += amount;
        address[] memory suppliedTokensList = users[user].suppliedTokenList;
        bool tokenExist = doesTokenExistInList(token, suppliedTokensList);
        if(!tokenExist) {
            users[user].suppliedTokenList.push(token);
        }
        fTokenInterface ftoken = fTokenInterface(fTokenAddress[token]);
        ftoken.mint(user, amount);
        emit TokenDeposit(user, token, amount);
    }

    function withdrawTokens(address token, uint256 amount) public {
        address user = msg.sender;
        require(users[user].unlockedTokens[token] >= amount, "FreeWill: Can't withdraw locked amount");
        updateInterestEarned(user);
        fTokenInterface ftoken = fTokenInterface(fTokenAddress[token]);
        ftoken.burn(user, amount);
        users[user].suppliedTokens[token] -= amount;
        users[user].unlockedTokens[token] -= amount;
        tokenSupply[token] -= amount;
        IERC20(token).transfer(user, amount);
        emit TokenWithdraw(user, token, amount);
    }

    function borrowEth(
        uint256 amount,
        address[] calldata tokens,
        uint256[] calldata amounts
    ) public {
        require(ethSupply > amount, "FreeWill: Insufficient Supply");
        uint256 collatoralValue = getValue(tokens, amounts, 0);   
        uint256 ethValue = fwSwap.getPriceEth(FUSD, amount);
        require((collatoralValue * collatoralFactor) / 1000 >= ethValue, "FreeWill: Not enough collatoral");
        address user = msg.sender;
        updateInterestOwed(user);
        ethSupply -= amount;
        users[user].ethBorrow.borrowedAmount += amount;
        for(uint i; i < tokens.length; i++) {
            require(users[user].unlockedTokens[tokens[i]] >= amounts[i], "FreeWill: Not enough tokens");
            users[user].ethBorrow.collatoralAmounts[tokens[i]] += amounts[i];
            users[user].unlockedTokens[tokens[i]] -= amounts[i];
            addCollatoralTokenForEth(user, tokens[i]);
        }
        payable(user).transfer(amount);
        emit BorrowEther(user, amount);
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
        uint256 tokenValue = fwSwap.getPrice(FUSD, token, amount);
        require((collatoralValue * collatoralFactor) / 1000 >= tokenValue, "FreeWill: Not enough collatoral");
        tokenSupply[token] -= amount;
        address user = msg.sender;
        updateInterestOwed(user);
        require(users[user].unlockedEther >= ethAmount, "FreeWill: Not enough Ether");
        users[user].unlockedEther -= ethAmount;
        users[user].borrows[token].collatoralEther += ethAmount;
        users[user].borrows[token].borrowedAmount += amount;
        address[] memory borrowedTokensList = users[user].borrowedTokenList;
        bool tokenExist = doesTokenExistInList(token, borrowedTokensList);
        if(!tokenExist) {
            users[user].borrowedTokenList.push(token);
        }
        for(uint i; i < tokens.length; i++) {
            require(users[user].unlockedTokens[tokens[i]] >= amounts[i], "FreeWill: Not enough tokens");
            users[user].borrows[token].collatoralAmounts[tokens[i]] += amounts[i];
            users[user].unlockedTokens[tokens[i]] -= amounts[i];
            addCollatoralToken(user, token, tokens[i]);
        }
        IERC20(token).transfer(user, amount);
        emit BorrowToken(user, token, amount);
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
            users[user].borrows[token].collatoralTokensList.push(collatoralToken);
        }
    }

    function doesTokenExistInList(address token, address[] memory list) private pure returns (bool) {
        bool tokenExist;
        for(uint i; i < list.length; i++) {
            if(list[i] == token) {
                tokenExist = true;
            }
        }
        return tokenExist;
    }

    function getValue(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256 ethAmount
    ) public view returns (uint256 value) {
        address fusd = FUSD;
        for(uint i; i < tokens.length; i++) {
            if(tokens[i] == fusd) {
                value += amounts[i];
            } else {
                value += fwSwap.getPrice(fusd, tokens[i], amounts[i]);
            }
        }
        if(ethAmount > 0) {
            value += fwSwap.getPriceEth(fusd, ethAmount);
        }
    }

    function getUnlockedAmountsValue(address user) public view returns (uint256 value) {
        address[] memory userTokens = users[user].suppliedTokenList;
        address fusd = FUSD;
        for(uint i; i < userTokens.length; i++) {
            if(userTokens[i] == fusd) {
                value += users[user].unlockedTokens[userTokens[i]];
            } else {
                value += fwSwap.getPrice(fusd, userTokens[i], users[user].unlockedTokens[userTokens[i]]);
            }
        }
        value += fwSwap.getPriceEth(fusd, users[user].unlockedEther);
    }

    function addToken(address token, address fToken) public onlyOwner {
        address actualToken = fTokenInterface(fToken).actualToken();
        require(actualToken == token, "FreeWill: fToken contract not belongs to this token");
        fTokenAddress[token] = fToken;
        allTokens.push(token);
    }

    function repayEth() public payable {
        address user = msg.sender;
        uint256 amount = users[user].ethBorrow.borrowedAmount;
        require(msg.value >= amount, "FreeWill: Pay full amount");
        updateInterestOwed(user);
        IERC20(address(fwt)).transferFrom(user, address(this), users[user].ethBorrow.interestOwed);
        uint collatoralTokensLength = users[user].ethBorrow.collatoralTokensList.length;
        for(uint i; i < collatoralTokensLength; i++) {
            address tkn = users[user].ethBorrow.collatoralTokensList[i];
            users[user].unlockedTokens[tkn] += users[user].ethBorrow.collatoralAmounts[tkn];
            delete users[user].ethBorrow.collatoralAmounts[tkn];
        }
        ethSupply -= amount;
        delete users[user].ethBorrow;
        emit RepayEther(user, amount);
    }

    function repayTokens(address token, uint256 amount) public {
        address user = msg.sender;
        uint256 borrowedAmount = users[user].borrows[token].borrowedAmount;
        require(amount >= borrowedAmount, "FreeWill: Pay full amount");
        IERC20(token).transferFrom(user, address(this), borrowedAmount);
        updateInterestOwed(user);
        IERC20(address(fwt)).transferFrom(user, address(this), users[user].borrows[token].interestOwed);
        for(uint i; i < users[user].borrows[token].collatoralTokensList.length; i++) {
            address tkn = users[user].borrows[token].collatoralTokensList[i];
            users[user].unlockedTokens[tkn] += users[user].borrows[token].collatoralAmounts[tkn];
            delete users[user].borrows[token].collatoralAmounts[tkn];
        }
        tokenSupply[token] += borrowedAmount;
        users[user].unlockedEther += users[user].borrows[token].collatoralEther;
        delete users[user].borrows[token];
        emit RepayToken(user, token, amount);
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
            "FreeWill: New collatoral amounts should be more or equal"
        );
        address user = msg.sender;
        for(uint i; i < tokens.length; i++) {
            if(amounts[i] > users[user].borrows[token].collatoralAmounts[tokens[i]]) {
                uint256 amountIncreased = amounts[i] - users[user].borrows[token].collatoralAmounts[tokens[i]];
                require(amountIncreased <= users[user].unlockedTokens[tokens[i]], "FreeWill: Insufficient tokens");
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
            "FreeWill: New collatoral amounts should be more or equal"
        );
        address user = msg.sender;
        for(uint i; i < tokens.length; i++) {
            if(amounts[i] > users[user].ethBorrow.collatoralAmounts[tokens[i]]) {
                uint256 amountIncreased = amounts[i] - users[user].ethBorrow.collatoralAmounts[tokens[i]];
                require(amountIncreased <= users[user].unlockedTokens[tokens[i]], "FreeWill: Insufficient tokens");
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
            ethValue = fwSwap.getPriceEth(fusd, ethAmount);
        }
        uint256 tokensValue;
        for(uint i; i < users[user].suppliedTokenList.length; i++) {
            address token = users[user].suppliedTokenList[i];
            uint256 amount = users[user].suppliedTokens[token];
            if(amount == 0) {
                continue;
            }
            tokensValue += fwSwap.getPrice(fusd, token, amount);
        }
        interestValue = ((ethValue + tokensValue)
                   * (block.timestamp - users[user].lastSupplyTimeStamp)
                   * supplyInterestRate)
                   / (365 * 24 * 60 * 60 * 1000 * 1000);
        if(interestValue > 0) {
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
            users[user].interestEarned += interest;
        }
        users[user].lastSupplyTimeStamp = block.timestamp;
    }

    function updateInterestOwed(address user) private {
        uint256 interestValue;
        uint256 interest;
        address fusd = FUSD;
        uint256 ethValue;
        uint256 ethAmount = users[user].ethBorrow.borrowedAmount;
        if(ethAmount > 0) {
            ethValue = fwSwap.getPriceEth(fusd, ethAmount);
            interestValue = (ethValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
            users[user].ethBorrow.interestOwed += interest;
        }
        uint256 tokensValue;
        for(uint i; i < users[user].borrowedTokenList.length; i++) {
            address token = users[user].borrowedTokenList[i];
            uint256 amount = users[user].borrows[token].borrowedAmount;
            if(amount == 0) {
                continue;
            }
            tokensValue = fwSwap.getPrice(fusd, token, amount);
            interestValue = (tokensValue * (block.timestamp - users[user].lastBorrowTimeStamp) * borrowInterestRate)
                        / (365 * 24 * 60 * 60 * 1000 * 1000);
            interest = fwSwap.getPrice(address(fwt), fusd, interestValue);
            users[user].borrows[token].interestOwed += interest;
        }
        users[user].lastBorrowTimeStamp = block.timestamp;
    }

    function claimInterest() public {
        address user = msg.sender;
        updateInterestEarned(user);
        uint256 interest = users[user].interestEarned;
        users[user].interestEarned = 0;
        fwt.mint(user, interest);
        emit ClaimInterest(user, interest);
    }

}