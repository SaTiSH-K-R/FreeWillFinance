import { createTheme, Grid, Stack, ThemeProvider, Typography } from '@mui/material'
import { BigNumber, utils } from 'ethers'
import BorrowMarkets from '../components/BorrowMarkets'
import SupplyMarkets from '../components/SupplyMarkets'
import styles from '../styles/Home.module.css'
import { DataContext } from "../Contexts/DataContext"
import { useContext, useState } from "react"
import { LoadingButton } from '@mui/lab'
import { useMoralis, useWeb3Contract } from 'react-moralis'
import { FREE_WILL_ABI, FREE_WILL_ADDRESS } from '../constants'
import { useNotification } from '@web3uikit/core'

export default function Home() {

  const { tvl, interestEarned, getInterestEarned } = useContext(DataContext)
  const { runContractFunction } = useWeb3Contract()
  const { isWeb3Enabled } = useMoralis()
  const [claimBtnLoading, setClaimBtnLoading] = useState(false)
  const dispatch = useNotification()

  const theme = createTheme({
    palette: {
      primary: {
        main: '#00D4D4'
      }
    }
  })

  const onClaimError = error => {
    console.log(error)
    setClaimBtnLoading(false)
    dispatch({
      type: 'error',
      title: 'Transaction Failed',
      message: 'Claim Failed',
      position: 'topR'
    })
  }

  const onClaimSuccess = async tx => {
    await tx.wait()
    setClaimBtnLoading(false)
    getInterestEarned()
    dispatch({
      type: 'success',
      title: 'Transaction Complete',
      message: 'Interest Claimed',
      position: 'topR'
    })
  }
  
  const handleClaim = async () => {
    if(!isWeb3Enabled) {
      return
    }
    setClaimBtnLoading(true)
    const tx = await runContractFunction({
      params: {
        abi: FREE_WILL_ABI,
        contractAddress: FREE_WILL_ADDRESS,
        functionName: 'claimInterest',
        params: {}
      },
      onError: error => onClaimError(error),
      onSuccess: tx => onClaimSuccess(tx)
    })
  }
  
  return (
    <div className={styles.container}>
      <Stack direction='column' alignItems='center'>
        <Typography
          variant='h4'
          mt={4}
          sx={{ color: '#005C50', display: {xs: 'block', sm: 'none'} }}
        >
          FreeWill Finance
        </Typography>
        <Typography
          variant='h3'
          mt={4}
          sx={{ color: '#005C50', display: {xs: 'none', sm: 'block'} }}
        >
          FreeWill Finance
        </Typography>
        <Typography
          variant='subtitle1'
          mt={2}
          sx={{ color: 'gray' }}
        >
          A DeFi where you can lend, borrow, provide multiple assets as collatorals
          and customize the amounts of collatorals later.
        </Typography>
      </Stack>
      <Grid
        container
        justifyContent='center'
      >
        <Grid item m={3} mb={0}>
          <div 
            style={{
              padding: '10px',
              width: '270px',
            }}
          > 
            <Stack alignItems='center' mb={1}>
              <Typography variant='h6' color='#005C50'>Total Value Locked</Typography>
            </Stack>
            <Stack alignItems='center' >
              <Typography>{`$${utils.formatEther(tvl.sub(tvl.mod(1e15)))}`}</Typography>
            </Stack>
          </div>
        </Grid>
        <Grid item m={3} mb={0}>
          <div 
            style={{
              padding: '10px',
              width: '270px',
            }}
          > 
            <Stack alignItems='center' mb={1}>
              <Typography variant='h6' color='#005C50'>Interest Earned</Typography>
            </Stack>
            <Stack alignItems='center' spacing={1}>
              <Typography>{`${utils.formatEther(interestEarned)} FWT`}</Typography>
              { isWeb3Enabled &&
                <ThemeProvider theme={theme}>
                  <LoadingButton
                    loading={claimBtnLoading}
                    onClick={handleClaim}
                    variant='contained'
                    size='small'
                    sx={{color: 'white'}}
                  >
                    Claim
                  </LoadingButton>
                </ThemeProvider>
              }
            </Stack>
          </div>
        </Grid>
      </Grid>
      <Grid
        container
        justifyContent='center'
        spacing={2}
        mt={3}
        px={{ sm:8, md: 6, lg: 8 }}
      >
        <Grid item xs={12} sm={12} md={6}>
          <SupplyMarkets/>
        </Grid>
        <Grid item xs={12} sm={12} md={6}>
          <BorrowMarkets/>
        </Grid>
      </Grid> 
    </div>
  )
}
