import { Box, createTheme, Dialog, DialogContent, DialogTitle, Divider, IconButton, InputBase, Paper, Stack, Tab, ThemeProvider, Typography } from "@mui/material";
import { LoadingButton, TabContext, TabList, TabPanel } from "@mui/lab"
import CloseIcon from '@mui/icons-material/Close'
import { useEffect, useState } from "react";
import { useMoralis, useWeb3Contract } from "react-moralis";
import { ERC20_ABI, FREE_WILL_ABI, FREE_WILL_ADDRESS } from "../constants";
import { BigNumber, constants, utils } from "ethers";
import { useNotification } from "@web3uikit/core";
import { DataContext } from "../Contexts/DataContext"
import { useContext } from "react"

export default function SupplyDialog(props) {

  const { updateData } = useContext(DataContext)
  const { open, onClose, token } = props
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [depositBtnLoading, setDepositBtnLoading] = useState(false)
  const [withdrawBtnLoading, setWithdrawBtnLoading] = useState(false)
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
  
  const handleTabChange = (e, newValue) => {
    setTabValue(newValue)
  }

  const handleClose = () => {
    setDepositAmount('')
    setWithdrawAmount('')
    setTabValue('1')
    onClose()
  }

  const onDepositError = (error) => {
    console.log(error)
    setDepositBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Deposit Failed',
      position: 'topR'
    })
  }

  const onDepositSuccess = async (txn) => {
    console.log(await txn.wait())
    setDepositBtnLoading(false)
    dispatch({
      type: 'success',
      title: 'Transaction Complete',
      message: 'Deposited Successfully',
      position: 'topR'
    })
    updateData()
    handleClose()
  }

  const handleDeposit = async () => {
    if(!isWeb3Enabled || depositAmount == '' || depositAmount == 0) {
      return
    }
    if(chainId !== '0x5') {
      window.alert('Switch network to Goerli Testnet')
      return
    }
    setDepositBtnLoading(true)
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
      if(allowance.lt(utils.parseEther(depositAmount))) {
        const tx = await runContractFunction({
          params: {
            abi: ERC20_ABI,
            contractAddress: token.address,
            functionName: 'approve',
            params: {
              spender: FREE_WILL_ADDRESS,
              amount: constants.MaxUint256
            },
            onError: error => {
              console.log(error)
              setDepositBtnLoading(true)
            }
          }
        })
        await tx?.wait()
      }
    }
    const tx = await runContractFunction({
      params: {
        ...options,
        functionName: token.address === 'ETH' ? 'depositEth' : 'depositTokens',
        msgValue: token.address === 'ETH' ? utils.parseEther(depositAmount) : 0,
        params: token.address === 'ETH' ? {} :  {token: token.address, amount: utils.parseEther(depositAmount)}
      },
      onSuccess: txn => onDepositSuccess(txn),
      onError: error => onDepositError(error)
    })
  }

  const onWithdrawSuccess = async (txn) => {
    console.log(await txn.wait())
    setWithdrawBtnLoading(false)
    dispatch({
      type: 'success',
      title: 'Transaction Completed',
      message: 'Withdrawn Successfully',
      position: 'topR'
    })
    updateData()
    handleClose()
  }

  const onWithdrawError = (error) => {
    console.log(error)
    setWithdrawBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Withdraw Failed',
      position: 'topR'
    })
  }

  const handleWithdraw = async () => {
    if(!isWeb3Enabled || withdrawAmount == '' || withdrawAmount == 0) {
      return
    }
    if(chainId !== '0x5') {
      window.alert('Switch network to Goerli Testnet')
      return
    }
    if(token.unlocked.lt(utils.parseEther(withdrawAmount))) {
      dispatch({
        type: 'warning',
        title: "Can't perform Withdraw",
        message: "You can withdraw unlocked amount only",
        position: 'topR'
      })
      return
    }
    setWithdrawBtnLoading(true)
    const tx = await runContractFunction({
      params: {
        ...options,
        functionName: token.address === 'ETH' ? 'withdrawEth' : 'withdrawTokens',
        params: token.address === 'ETH'
          ? {amount: utils.parseEther(withdrawAmount)}
          : {token: token.address, amount: utils.parseEther(withdrawAmount)}
      },
      onSuccess: txn => onWithdrawSuccess(txn),
      onError: error => onWithdrawError(error)
    })
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
            <TabList onChange={handleTabChange} aria-label="Supply Dialog" centered>
              <Tab label="Supply" value="1"/>
              <Tab label="Withdraw" value="2"/>
            </TabList>
          </ThemeProvider>
        </Box>
        <TabPanel value="1">
          <Stack direction='row' spacing={2} justifyContent="space-between" mb={2}>
            <Typography sx={{ color: 'gray' }}>{`Supplied Amount: `}</Typography>
            <Typography>{`${utils.formatEther(token.balance)} ${token.symbol}`}</Typography>
          </Stack>
          <Stack direction='row' justifyContent="space-between" spacing={2} mb={2}>
            <Typography sx={{ color: 'gray' }}>{`Unlocked Amount: `}</Typography>
            <Typography>{`${utils.formatEther(token.unlocked)} ${token.symbol}`}</Typography>
          </Stack>
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
            <InputBase
              sx={{ ml: 1, flex: 1 }}
              placeholder="0"
              value={depositAmount}
              onChange={(e) => {
                const regex = /^\d*\.?\d*$/
                if (e.target.value === '' || regex.test(e.target.value)) {
                  setDepositAmount(e.target.value)
                }
              }}
            />
            <Typography p={1} sx={{color: 'gray'}}>{token.symbol}</Typography>
          </Paper>
          <Stack
            mt={2}
          >
            <ThemeProvider theme={theme}>
              <LoadingButton
                loading={depositBtnLoading}
                variant='contained'
                sx={{color: 'white'}}
                onClick={handleDeposit}
              >
                Deposit
              </LoadingButton>
            </ThemeProvider>
          </Stack>
        </TabPanel>
        <TabPanel value="2">
          <Stack direction='row' spacing={2} justifyContent="space-between" mb={2}>
            <Typography sx={{ color: 'gray' }}>{`Supplied Amount: `}</Typography>
            <Typography>{`${utils.formatEther(token.balance)} ${token.symbol}`}</Typography>
          </Stack>
          <Stack direction='row' justifyContent="space-between" spacing={2} mb={2}>
            <Typography sx={{ color: 'gray' }}>{`Unlocked Amount: `}</Typography>
            <Typography>{`${utils.formatEther(token.unlocked)} ${token.symbol}`}</Typography>
          </Stack>
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
            <InputBase
              sx={{ ml: 1, flex: 1 }}
              placeholder="0"
              value={withdrawAmount}
              onChange={(e) => {
                const regex = /^\d*\.?\d*$/
                if (e.target.value === '' || regex.test(e.target.value)) {
                  setWithdrawAmount(e.target.value)
                }
              }}
            />
            <Typography p={1} sx={{color: 'gray'}}>{token.symbol}</Typography>
          </Paper>
          <Stack
            mt={2}
          >
            <ThemeProvider theme={theme}>
              <LoadingButton
                loading={withdrawBtnLoading}
                variant='contained'
                sx={{color: 'white'}}
                onClick={handleWithdraw}
              >
                Withdraw
              </LoadingButton>
            </ThemeProvider>
          </Stack>
        </TabPanel>
      </TabContext>
      </DialogContent>
    </Dialog>
  )
}