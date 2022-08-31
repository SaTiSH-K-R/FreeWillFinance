import { BigNumber, ethers } from "ethers"
import { createContext, useEffect, useState } from "react"
import { useMoralis, useWeb3Contract } from "react-moralis"
import { ERC20_ABI, FREE_WILL_ABI, FREE_WILL_ADDRESS } from "../constants"

const DataContext = createContext()

const DataProvider = ({children}) => {

  const { isWeb3Enabled, account, chainId } = useMoralis()
  const { runContractFunction } = useWeb3Contract()
  const [allTokens, setAllTokens] = useState([])
  const [interestEarned, setInterestEarned] = useState(BigNumber.from(0))
  const [tvl, setTVL] = useState(BigNumber.from(0))

  const options = {
    abi: FREE_WILL_ABI,
    contractAddress: FREE_WILL_ADDRESS
  }

  useEffect(() => {
    if(isWeb3Enabled && chainId == '0x5') {
      getUserMarkets()
    } else {
      getMarkets()
    }
    //eslint-disable-next-line
  }, [isWeb3Enabled, account, chainId])
  
  const getTVL = async () => {
    const provider = new ethers.providers.AlchemyProvider('goerli')
    const freeWillContract = new ethers.Contract(FREE_WILL_ADDRESS, FREE_WILL_ABI, provider)
    const tokens = await freeWillContract.getAllTokens()
    const ethSupply = await freeWillContract.ethSupply()
    let amounts = []
    for (const token of tokens) {
      const supply = await freeWillContract.tokenSupply(token)
      amounts.push(supply)
    }
    const tvl = await freeWillContract.getValue(tokens, amounts, ethSupply)
    console.log(tvl)
    setTVL(tvl)
  }
  
  const getMarkets = async () => {
    const provider = new ethers.providers.AlchemyProvider('goerli')
    const freeWillContract = new ethers.Contract(FREE_WILL_ADDRESS, FREE_WILL_ABI, provider)
    const tokens = await freeWillContract.getAllTokens()
    const ethLiquidity = await freeWillContract.ethSupply()
    let temp = [{
      address: 'ETH',
      name: 'Ether',
      symbol: 'ETH',
      liquidity: ethLiquidity,
      balance: BigNumber.from(0),
      borrowed: BigNumber.from(0),
      unlocked: BigNumber.from(0),
      interestOwed: BigNumber.from(0)
    }]
    for (const address of tokens) {
      const tokenContract = new ethers.Contract(
        address,
        ['function name() view returns (string)','function symbol() view returns (string)'],
        provider
      )
      const name = await tokenContract.name()
      const symbol = await tokenContract.symbol()
      const liquidity = await freeWillContract.tokenSupply(address)
      temp = [ ...temp, {
        name,
        symbol,
        address,
        liquidity,
        balance: BigNumber.from(0),
        borrowed: BigNumber.from(0),
        unlocked: BigNumber.from(0),
        interestOwed: BigNumber.from(0)
      } ]
    }
    console.log("Web3 not Enabled:: ", JSON.parse(JSON.stringify(temp)))
    setAllTokens(temp)
    getTVL()
  }
  
  const getUserMarkets = async () => {
    const _interestEarned = await runContractFunction({
      params: {
        ...options,
        functionName: 'getInterestEarned',
        params: {}
      },
      onError: error => console.log(error)
    })
    setInterestEarned(_interestEarned)
    let temp = []
    const ethLiquidity = await runContractFunction({
      params: {
        ...options,
        functionName: 'ethSupply',
        params: {}
      }
    })
    const ethBalance = await runContractFunction({
      params: {
        ...options,
        functionName: 'getBalanceOfEthSupplied',
        params: { user: account }
      }
    })
    const ethBorrowed = await runContractFunction({
      params: {
        ...options,
        functionName: 'getBalanceOfEthBorrowed',
        params: { user: account }
      }
    })
    const ethUnlocked = await runContractFunction({
      params: {
        ...options,
        functionName: 'getUnlockedEthAmount',
        params: { user: account }
      }
    })
    const interestOwed = await runContractFunction({
      params: {
        ...options,
        functionName: 'getInterestOwedEth',
        params: {}
      },
      onError: err => console.log(err)
    })
    console.log(interestOwed)
    temp.push({
      address: 'ETH',
      name: 'Ether',
      symbol: 'ETH',
      balance: ethBalance,
      borrowed: ethBorrowed,
      unlocked: ethUnlocked,
      liquidity: ethLiquidity,
      interestOwed
    })
    const tokens = await runContractFunction({
      params: {
        ...options,
        functionName: 'getAllTokens',
        params: {}
      }
    })
    for (const token of tokens) {
      const name = await runContractFunction({
        params: {
          abi: ERC20_ABI,
          contractAddress: token,
          functionName: 'name',
          params: {}
        }
      })
      const symbol = await runContractFunction({
        params: {
          abi: ERC20_ABI,
          contractAddress: token,
          functionName: 'symbol',
          params: {}
        }
      })
      const liquidity = await runContractFunction({
        params: {
          ...options,
          functionName: 'tokenSupply',
          params: { '': token }
        }
      })
      const balance = await runContractFunction({
        params: {
          ...options,
          functionName: 'getBalanceOfTokenSupplied',
          params: { user: account, token: token }
        }
      })
      const borrowed = await runContractFunction({
        params: {
          ...options,
          functionName: 'getBalanceOfTokenBorrowed',
          params: { user: account, token: token }
        }
      })
      const unlocked = await runContractFunction({
        params: {
          ...options,
          functionName: 'getUnlockedTokenAmount',
          params: { user: account, token: token }
        }
      })
      const interestOwed = await runContractFunction({
        params: {
          ...options,
          functionName: 'getInterestOwed',
          params: { token: token }
        },
      })
      console.log(interestOwed)
      temp.push({
        name,
        symbol,
        address: token,
        liquidity,
        balance,
        borrowed,
        unlocked,
        interestOwed
      })
    }
    console.log("Web3 enabled:: ", JSON.parse(JSON.stringify(temp)))
    setAllTokens(temp)
    getTVL()
  }

  const getInterestEarned = async () => {
    if(!isWeb3Enabled) {
      window.alert('Please connect to a wallet')
      return
    }
    const _interestEarned = await runContractFunction({
      params: {
        ...options,
        functionName: 'getInterestEarned',
        params: {}
      },
      onError: error => console.log(error)
    })
    console.log(_interestEarned)
    setInterestEarned(_interestEarned)
  }
  
  return (
    <DataContext.Provider
      value={{
        tokens: allTokens,
        updateData: getUserMarkets,
        interestEarned,
        getInterestEarned,
        tvl
      }}
    >
      {children}
    </DataContext.Provider>
  )
}

export { DataContext, DataProvider }