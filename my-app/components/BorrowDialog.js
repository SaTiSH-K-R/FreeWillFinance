import {
  Box,
  Button,
  createTheme,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Stack,
  Tab,
  ThemeProvider,
  Typography
} from "@mui/material";
import { LoadingButton, TabContext, TabList, TabPanel } from "@mui/lab"
import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useState } from "react";
import { useMoralis, useWeb3Contract } from "react-moralis";
import { ERC20_ABI, FREE_WILL_ABI, FREE_WILL_ADDRESS, FREE_WILL_SWAP_ABI, FREE_WILL_SWAP_ADDRESS, FUSD_ADDRESS } from "../constants";
import { BigNumber, constants, utils } from "ethers";
import { useNotification } from "@web3uikit/core";
import { DataContext } from "../Contexts/DataContext"
import { useContext } from "react"

export default function BorrowDialog(props) {

  
  const { open, onClose, tokenIndex } = props
  const { tokens: allTokens, updateData } = useContext(DataContext)
  const [token, setToken] = useState({
    name: '',
    symbol: '',
    address: '',
    borrowed: BigNumber.from(0),
    liquidity: BigNumber.from(0),
    unlocked: BigNumber.from(0),
    interestOwed: BigNumber.from(0)
  })
  const [tokens, setTokens] = useState([])
  const [borrowAmount, setBorrowAmount] = useState('')
  const [borrowAmountValue, setBorrowAmountValue] = useState(BigNumber.from(0))
  const [collatoralAmounts, setCollatoralAmounts] = useState([])
  const [minCollatoralValue, setMinCollatoralValue] = useState(BigNumber.from(0))
  const [collatoralValue, setCollatoralValue] = useState(BigNumber.from(0))
  const [currentCollatorals, setCurrentCollatorals] = useState([])
  const [newCollatoralValue, setNewCollatoralValue] = useState(BigNumber.from(0))
  const [currentCollatoralValue, setCurrentCollatoralValue] = useState(BigNumber.from(0))
  const [borrowBtnLoading, setBorrowBtnLoading] = useState(false)
  const [repayBtnLoading, setRepayBtnLoading] = useState(false)
  const [adjustBtnLoading, setAdjustBtnLoading] = useState(false)
  const [tabValue, setTabValue] = useState('1')
  const { isWeb3Enabled, account, chainId } = useMoralis()
  const { runContractFunction } = useWeb3Contract()
  const dispatch = useNotification()

  const options = {
    abi: FREE_WILL_ABI,
    contractAddress: FREE_WILL_ADDRESS
  }

  const theme = createTheme({
    palette: {
      primary: {
        main: '#00D4D4'
      }
    }
  })

  useEffect(() => {
    console.log(JSON.parse(JSON.stringify(allTokens)))
    if(allTokens.length === 0) {
      return
    }
    setToken(allTokens[tokenIndex])
    const temp = allTokens.filter(tk => tk.address.toLowerCase() !== allTokens[tokenIndex].address.toLowerCase())
    setTokens(temp)
    setMinCollatoralValue(BigNumber.from(0))
  }, [tokenIndex, allTokens])

  useEffect(() => {
    if(tokens.length == 0) {
      return
    }
    let temp = []
    for (const tok of tokens) {
      temp = [
        ...temp,
        {
          address: tok.address,
          amount: '',
          value: BigNumber.from(0)
        }
      ]
    }
    setCollatoralAmounts(temp)
    //eslint-disable-next-line
  }, [tokens])

  useEffect(() => {
    if(!isWeb3Enabled || chainId != '0x5') {
      return
    }
    if(token.address == '' || tokens.length == 0) {
      return
    }
    (async () => {
      let ethAmount = BigNumber.from(0)
      let colTokens
      let colAmounts
      if(token.address === 'ETH') {
        [colTokens, colAmounts] = await runContractFunction({
          params: {
            ...options,
            functionName: 'getCollatoralsOfEth',
            params: {}
          }
        })
      } else {
        [ethAmount, colTokens, colAmounts] = await runContractFunction({
          params: {
            ...options,
            functionName: 'getCollatoralsOfToken',
            params: { token: token.address }
          }
        })
      }
      const _currentCollatoralValue = await runContractFunction({
        params: {
          ...options,
          functionName: 'getValue',
          params: {
            tokens: colTokens,
            amounts: colAmounts,
            ethAmount: ethAmount
          }
        },
        onError: error => console.log(error)
      })
      setCurrentCollatoralValue(_currentCollatoralValue)
      const temp = tokens.map(tok => {
        let amount = BigNumber.from(0)
        for (let i = 0; i < colTokens.length; i++) {
          if(colTokens[i].toLowerCase() === tok.address.toLowerCase()) {
            amount = colAmounts[i]
          }
        }
        return ({
          address: tok.address,
          value: BigNumber.from(0),
          newAmount: '',
          currentColl: tok.address == 'ETH' ? ethAmount : amount
        })
      })
      setCurrentCollatorals(temp)
    })()
    //eslint-disable-next-line
  }, [tokens, isWeb3Enabled, account])

  useEffect(() => {
    let value = BigNumber.from(0)
    for (const tok of collatoralAmounts) {
      value = value.add(tok.value)
    }
    setCollatoralValue(value)
  }, [collatoralAmounts])

  useEffect(() => {
    let value = BigNumber.from(0)
    for (const tok of currentCollatorals) {
      value = value.add(tok.value)
    }
    setNewCollatoralValue(value)
  }, [currentCollatorals])

  const getValue = async (address, amount) => {
    if(amount === '' || amount == 0 || chainId != '0x5') {
      return BigNumber.from(0)
    }
    if(address.toLowerCase() === FUSD_ADDRESS.toLowerCase()) {
      return utils.parseEther(amount)
    }
    const value = await runContractFunction({
      params: {
        abi: FREE_WILL_SWAP_ABI,
        contractAddress: FREE_WILL_SWAP_ADDRESS,
        functionName: address == 'ETH' ? 'getPriceEth' : 'getPrice',
        params: address == 'ETH'
          ? { FUSD: FUSD_ADDRESS, amount: utils.parseEther(amount) }
          : { FUSD: FUSD_ADDRESS, token: address, amount: utils.parseEther(amount) }
      }
    })
    return value
  }

  const handleBorrowSuccess = async (tx) => {
    await tx.wait()
    setBorrowBtnLoading(false)
    dispatch({
      type: 'success',
      title: 'Transaction Complete',
      message: 'Borrow Success',
      position: 'topR'
    })
    updateData()
    handleClose()
  }

  const handleBorrowError = error => {
    console.log(error)
    setBorrowBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Borrow Failed',
      position: 'topR'
    })
  }

  const handleBorrow = async () => {
    if(!isWeb3Enabled) {
      window.alert("Plese connect to a wallet")
      return
    }
    if(chainId != '0x5') {
      window.alert('Swith to Goerli Testnet')
      return
    }
    if(borrowAmount === '' || borrowAmount == 0) {
      window.alert('Enter Borrow amount')
      return
    }
    if(collatoralValue.lt(minCollatoralValue)) {
      window.alert('Enter sufficient collatoral')
      return
    }
    let colTokens = []
    let colAmounts = []
    let ethAmount
    let i = 0
    for (const coll of collatoralAmounts) {
      if(coll.address === 'ETH') {
        ethAmount = utils.parseEther(coll.amount)
      } else {
        if(coll.amount === '' || coll.amount == 0) {
          continue
        }
        colTokens[i] = coll.address
        colAmounts[i] = utils.parseEther(coll.amount)
        i++
      }
    }
    setBorrowBtnLoading(true)
    const tx = await runContractFunction({
      params: {
        ...options,
        functionName: token.address === 'ETH'
          ? 'borrowEth'
          : 'borrowToken',
        params: token.address === 'ETH'
          ? { amount: utils.parseEther(borrowAmount), tokens: colTokens, amounts: colAmounts }
          : { token: token.address, amount: utils.parseEther(borrowAmount), tokens: colTokens, amounts: colAmounts, ethAmount: ethAmount }
      },
      onSuccess: tx => handleBorrowSuccess(tx),
      onError: error => handleBorrowError(error)
    })
  }

  const handleRepaySuccess = async (tx) => {
    await tx.wait()
    setRepayBtnLoading(false)
    dispatch({
      type: 'success',
      title: 'Transaction Completed',
      message: 'Tokens Repaid',
      position: 'topR'
    })
    updateData()
    handleClose()
  }

  const handleRepayError = error => {
    console.log(error)
    setRepayBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Repaying Failed',
      position: 'topR'
    })
  }

  const handleRepay = async () => {
    if(!isWeb3Enabled) {
      return
    }
    if(chainId != '0x5') {
      window.alert('Swith to Goerli Testnet')
      return
    }
    if(token.borrowed.toString() == 0 || token.borrowed.toString() == '') {
      window.alert('You did not borrowed this asset')
      return
    }
    if(token.address !== 'ETH') {
      const allowance = await runContractFunction({
        params: {
          abi: ERC20_ABI,
          contractAddress: token.address,
          functionName: 'allowance',
          params: {
            owner: account,
            spender: FREE_WILL_ADDRESS
          }
        },
        onError: error => console.log(error)
      })
      setRepayBtnLoading(true)
      if(allowance.lt(token.borrowed)) {
        const tx = await runContractFunction({
          params: {
            abi: ERC20_ABI,
            contractAddress: token.address,
            functionName: 'approve',
            params: {
              spender: FREE_WILL_ADDRESS,
              amount: constants.MaxUint256
            }
          },
          onError: error => {
            console.log(error)
            setRepayBtnLoading(false)
          }
        })
        await tx?.wait()
      }
    }
    const tx = await runContractFunction({
      params: {
        ...options,
        functionName: token.address === 'ETH'
          ? 'repayEth'
          : 'repayTokens',
        params: token.address === 'ETH'
          ? {} : { token: token.address, amount: token.borrowed }
      },
      onSuccess: tx => handleRepaySuccess(tx),
      onError: error => handleRepayError(error)
    })
  }

  const handleAdjustCollatoral = async () => { 
    if(!isWeb3Enabled) {
      window.alert("Plese connect to a wallet")
      return
    }
    if(chainId != '0x5') {
      window.alert('Switch to Goerli Testnet')
      return
    }
    if(token.borrowed.eq(BigNumber.from(0))) {
      window.alert("Borrow some amount first ;)")
      return
    }
    if(newCollatoralValue.lt(minCollatoralValue)) {
      window.alert('Enter sufficient collatoral')
      return
    }
    let colTokens = []
    let colAmounts = []
    let ethAmount = BigNumber.from(0)
    let i = 0
    for (const coll of currentCollatorals) {
      if(coll.address === 'ETH') {
        ethAmount = utils.parseEther(coll.newAmount)
      } else {
        if(coll.newAmount === '' || coll.newAmount == 0) {
          continue
        }
        colTokens[i] = coll.address
        colAmounts[i] = utils.parseEther(coll.newAmount)
        i++
      }
    }
    console.log(colAmounts, colTokens, ethAmount)
    setAdjustBtnLoading(true)
    const tx = await runContractFunction({
      params: {
        ...options,
        functionName: token.address === 'ETH'
          ? 'adjustCollatoralsOfEth'
          : 'adjustCollatoralsOfTokens',
        params: token.address === 'ETH'
          ? { tokens: colTokens, amounts: colAmounts }
          : { token: token.address, tokens: colTokens, amounts: colAmounts, ethAmount: ethAmount }
      },
      onSuccess: tx => onAdjustSuccess(tx),
      onError: error => onAdjustError(error)
    })
  }

  const onAdjustSuccess = async (tx) => {
    await tx.wait()
    setAdjustBtnLoading(false)
    dispatch({
      type: 'success',
      title: 'Transaction Completed',
      message: 'Collatorals adjusted',
      position: 'topR'
    })
    updateData()
    handleClose()
  }

  const onAdjustError = (error) => {
    console.log(error)
    setAdjustBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Collatoral adjusting Failed',
      position: 'topR'
    })
  }

  const handleTabChange = (e, newValue) => {
    setTabValue(newValue)
  }

  const handleClose = () => {
    setTabValue('1')
    setBorrowAmount('')
    setBorrowAmountValue(BigNumber.from(0))
    onClose()
  }

  return (
    <Dialog
      onClose={handleClose}
      open={open}
      PaperProps={{ style: { borderRadius: 10 } }}
    >
      <DialogTitle>
        <Typography align='center' variant="inherit" color='#005C50'><b>{token.name}</b></Typography>
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <Divider orientation="horizontal" />
      <DialogContent sx={{px: 0, pt: 0, pb: 1}}>
        <TabContext value={tabValue}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', width: {xs: '320px', sm: '400px'} }}>
            <ThemeProvider theme={theme}>
              <TabList onChange={handleTabChange} aria-label="Borrow Dialog" centered>
                <Tab label="Borrow" value="1"/>
                <Tab label="Repay" value="2"/>
                <Tab label="Adjust Collatoral" value="3" wrapped/>
              </TabList>
            </ThemeProvider>
          </Box>
          <TabPanel value="1">
            <Stack direction='row' spacing={2} justifyContent="space-between" mb={2} px={2}>
              <Typography sx={{ color: 'gray' }}>{`Borrowed Amount: `}</Typography>
              <Typography>{`${utils.formatEther(token.borrowed)} ${token.symbol}`}</Typography>
            </Stack>
            <Stack direction='row' justifyContent="space-between" spacing={2} mb={2} px={2}>
              <Typography sx={{ color: 'gray' }}>{`Liquidity: `}</Typography>
              <Typography>{`${utils.formatEther(token.liquidity)} ${token.symbol}`}</Typography>
            </Stack>
            <Divider orientation="horizontal" sx={{mx: -3}}/>
            <Stack mb={1}>
              <Paper
                elevation={0}
                component='form'
                sx={{
                  px: '4px',
                  py: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#eae7f7',
                  borderRadius: '10px',
                  mt: 2
                }}
              >
                <InputBase
                  sx={{ ml: 1, flex: 1 }}
                  placeholder="Borrow Amount"
                  value={borrowAmount}
                  onChange={async (e) => {
                    const regex = /^\d*\.?\d*$/
                    if (e.target.value === '' || regex.test(e.target.value)) {
                      setBorrowAmount(e.target.value)
                      const value = await getValue(token.address, e.target.value)
                      setBorrowAmountValue(value)
                      const _minCollatoralValue = value.mul(100).div(60)
                      setMinCollatoralValue(_minCollatoralValue)
                    }
                  }}
                />
                <Typography p={1} sx={{color: 'gray'}}>{token.symbol}</Typography>
              </Paper>
              <Typography variant="caption" sx={{px: 1}}>
                {`Value: $${utils.formatEther(borrowAmountValue.sub(borrowAmountValue.mod(1e15)))}`}
              </Typography>
            </Stack>
            <Divider orientation="horizontal" sx={{mx: -3}}/>
            <Stack alignItems='center' color='#005C50'>
              <Typography>Collatorals</Typography>
            </Stack>
            <Divider orientation="horizontal" sx={{mx: -3}}/>
            <Stack m={1} alignItems='center'>
              <Typography variant='caption'>
                {`Sum of collatoral amount value must be > `}
                <Typography variant='caption' color='green'>
                  {`$${utils.formatEther(minCollatoralValue.sub(minCollatoralValue.mod(1e15)))}`}
                </Typography>
              </Typography>
            </Stack>
            { tokens.length !== 0 && tokens.map(tkn => {
              return (
                <div key={tkn.address}>
                  <Typography variant='caption' sx={{pl: 1}}>
                    {`Available amount: ${utils.formatEther(tkn.unlocked.sub(tkn.unlocked.mod(1e12)))} ${tkn.symbol}`}
                  </Typography>
                  <Stack  mb={1}>
                    <Paper
                      elevation={0}
                      component='form'
                      sx={{
                        px: '4px',
                        py: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#eae7f7',
                        borderRadius: '10px'
                      }}
                    >
                      <Typography p={1} sx={{color: 'gray'}} variant='caption'>{tkn.symbol}</Typography>
                      <InputBase
                        sx={{ ml: 1, flex: 1 }}
                        placeholder="0"
                        size="small"
                        value={(() => {
                          if(collatoralAmounts.length == 0) {
                            return ''
                          }
                          const t = collatoralAmounts.find(tk => {
                            return tk.address.toLowerCase() === tkn.address.toLowerCase()
                          })
                          if(t == undefined) {
                            return ''
                          }
                          return t.amount
                        })()}
                        onChange={async (e) => {
                          const regex = /^\d*\.?\d*$/
                          if (e.target.value === '' || regex.test(e.target.value)) {
                            let temp = []
                            for (const tok of collatoralAmounts) {
                              if(tok.address.toLowerCase() === tkn.address.toLowerCase()) {
                                temp = [
                                  ...temp,
                                  {
                                    address: tok.address,
                                    amount: e.target.value,
                                    value: await getValue(tok.address, e.target.value)
                                  }
                                ]
                              } else {
                                temp = [
                                  ...temp,
                                  tok
                                ]
                              }
                            }
                            setCollatoralAmounts(temp)
                          }
                        }}
                      />
                      <Typography variant='caption' sx={{pl: 2}}>
                        ${
                          (() => {
                            if(collatoralAmounts.length == 0) {
                              return '0.0'
                            }
                            const t = collatoralAmounts?.find(tk => tk.address.toLowerCase() === tkn.address.toLowerCase())
                            if(t == undefined) {
                              return '0.0'
                            }
                            return utils.formatEther(t.value.sub(t.value.mod(1e15)))
                          })()
                        }
                      </Typography>
                    </Paper>
                  </Stack>
                </div>
              )
            })}
            <Stack alignItems='center' mt={2}>
              <Typography variant="caption">
                Sum of Collatoral values: 
                <Typography variant="caption" color={collatoralValue.lt(minCollatoralValue) ? 'red' : 'green'}>
                  {` $${utils.formatEther(collatoralValue.sub(collatoralValue.mod(1e15)))}`}
                </Typography>
              </Typography>
            </Stack>
            <Stack
              mt={2}
            >
              <ThemeProvider theme={theme}>
                <LoadingButton
                  loading={borrowBtnLoading}
                  variant='contained'
                  sx={{color: 'white'}}
                  onClick={handleBorrow}
                >
                  Borrow
                </LoadingButton>
              </ThemeProvider>
            </Stack>
          </TabPanel>
          <TabPanel value="2">
            <Stack direction='row' spacing={2} justifyContent="space-between" mb={2}>
              <Typography sx={{ color: 'gray' }}>{`Borrowed Amount: `}</Typography>
              <Typography>{`${utils.formatEther(token.borrowed.sub(token.borrowed.mod(1e10)))} ${token.symbol}`}</Typography>
            </Stack>
            <Stack direction='row' spacing={2} justifyContent="space-between" mb={2}>
              <Typography sx={{ color: 'gray' }}>{`Interest: `}</Typography>
              <Typography>{`${utils.formatEther(token.interestOwed)} FWT`}</Typography>
            </Stack>
            { token.borrowed.gt(BigNumber.from(0)) &&
              <Stack direction='row' spacing={2} justifyContent="center" mb={2}>
                <Typography sx={{ color: 'gray' }} variant='caption'>
                  {`Maintain atleast ${utils.formatEther(token.interestOwed.mul(120).div(100))} FWT in your wallet while repaying`}
                </Typography>
              </Stack>
            }
            <Stack
              mt={2}
            >
              <ThemeProvider theme={theme}>
                <LoadingButton
                  loading={repayBtnLoading}
                  variant='contained'
                  sx={{color: 'white'}}
                  onClick={handleRepay}
                >
                  Repay
                </LoadingButton>
              </ThemeProvider>
            </Stack>
          </TabPanel>
          <TabPanel value="3">
            <Stack direction='row' spacing={2} justifyContent="space-between" mb={2}>
              <Typography sx={{ color: 'gray' }}>{`Borrowed Amount: `}</Typography>
              <Typography>{`${utils.formatEther(token.borrowed)} ${token.symbol}`}</Typography>
            </Stack>
            <Divider orientation="horizontal" sx={{mx: -3}}/>
            <Stack alignItems='center' color='#005C50'>
              <Typography>Collatorals</Typography>
            </Stack>
            <Divider orientation="horizontal" sx={{mx: -3}}/>
            <Stack alignItems='center' mt={1}>
              <Typography variant='subtitle2'>Adjust collatoral amounts by increasing or decreasing</Typography>
            </Stack>
            <Stack m={1} alignItems='center'>
              <Typography variant='caption'>
                {`Sum of collatoral amount value must be > `}
                <Typography variant='caption' color='green'>
                  {`$${utils.formatEther(currentCollatoralValue.sub(currentCollatoralValue.mod(1e15)))}`}
                </Typography>
              </Typography>
            </Stack>
            { tokens.map(tkn => {
              return (
                <div key={tkn.address}>
                  <Stack direction='column' mt={2}>
                    <Typography variant='caption' sx={{pl: 1}}>
                      {`Available amount: ${utils.formatEther(tkn.unlocked.sub(tkn.unlocked.mod(1e12)))} ${tkn.symbol}`}
                    </Typography>
                    <Typography variant='caption' sx={{pl: 1}}>
                      {`Current Collatoral: ${(() => {
                        const t = currentCollatorals?.find(tk => tkn.address.toLowerCase() === tk.address.toLowerCase())
                        if(t == undefined) {
                          return '0.0'
                        }
                        return utils.formatEther(t.currentColl.sub(t.currentColl.mod(1e12)))
                      })()} ${tkn.symbol}`}
                    </Typography>
                  </Stack>
                  <Stack  mb={1}>
                    <Paper
                      elevation={0}
                      component='form'
                      sx={{
                        px: '4px',
                        py: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#eae7f7',
                        borderRadius: '10px'
                      }}
                    >
                      <Typography p={1} sx={{color: 'gray'}} variant='caption'>{tkn.symbol}</Typography>
                      <InputBase
                        sx={{ ml: 1, flex: 1 }}
                        placeholder="0"
                        size="small"
                        value={(() => {
                          if(currentCollatorals.length === 0) {
                            return ''
                          }
                          const t = currentCollatorals?.find(tk => {
                            return tk.address.toLowerCase() === tkn.address.toLowerCase()
                          })
                          if(t == undefined) {
                            return ''
                          }
                          return t.newAmount
                        })()}
                        onChange={async (e) => {
                          const regex = /^\d*\.?\d*$/
                          if (e.target.value === '' || regex.test(e.target.value)) {
                            let temp = []
                            for (const tok of currentCollatorals) {
                              if(tok.address.toLowerCase() === tkn.address.toLowerCase()) {
                                temp = [
                                  ...temp,
                                  {
                                    address: tok.address,
                                    newAmount: e.target.value,
                                    value: await getValue(tok.address, e.target.value),
                                    currentColl: tok.currentColl
                                  }
                                ]
                              } else {
                                temp = [
                                  ...temp,
                                  tok
                                ]
                              }
                            }
                            setCurrentCollatorals(temp)
                          }
                        }}
                      />
                      <Typography variant='caption' sx={{pl: 2}}>
                        ${
                          (() => {
                            if(currentCollatorals.length == 0) {
                              return '0.0'
                            }
                            const t = currentCollatorals?.find(tk => tk.address.toLowerCase() === tkn.address.toLowerCase())
                            if(t == undefined) {
                              return '0.0'
                            }
                            return utils.formatEther(t.value.sub(t.value.mod(1e15)))
                          })()
                        }
                      </Typography>
                    </Paper>
                  </Stack>
                </div>
              )
            })}
            <Stack alignItems='center' mt={2}>
              <Typography variant="caption">
                Sum of Collatoral values: 
                <Typography variant='caption' color={newCollatoralValue.lt(currentCollatoralValue) ? 'red' : 'green'}>
                  {` $${utils.formatEther(newCollatoralValue.sub(newCollatoralValue.mod(1e15)))}`}
                </Typography>
              </Typography>
            </Stack>
            <Stack
              mt={2}
            >
              <ThemeProvider theme={theme}>
                <LoadingButton
                  loading={adjustBtnLoading}
                  variant='contained'
                  sx={{color: 'white'}}
                  onClick={handleAdjustCollatoral}
                >
                  Adjust
                </LoadingButton>
              </ThemeProvider>
            </Stack>
          </TabPanel>
        </TabContext>
      </DialogContent>
    </Dialog>
  )
}