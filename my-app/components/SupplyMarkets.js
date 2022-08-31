import { Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material"
import { useState } from "react"
import { FREE_WILL_ABI, FREE_WILL_ADDRESS } from "../constants"
import { BigNumber, utils } from 'ethers'
import SupplyDialog from "./SupplyDialog"
import { DataContext } from "../Contexts/DataContext"
import { useContext } from "react"

export default function SupplyMarkets() {

  const { tokens } = useContext(DataContext)
  const [open, setOpen] = useState(false)
  const [tokenToDialog, setTokenToDialog] = useState({
    name: '',
    symbol: '',
    address: '',
    liquidity: BigNumber.from(0),
    balance: BigNumber.from(0),
    borrowed: BigNumber.from(0),
    unlocked: BigNumber.from(0)
  })

  const handleRowClick = (token) => {
    setTokenToDialog(token)
    setOpen(true)
  }

  const handleDialogClose = () => {
    setOpen(false)
  }
  
  return (
    <TableContainer
      component={Paper}
      sx={{ borderRadius: 4 }}
    >
      <Typography variant='h6' p={2}>Supply Markets</Typography>
      <Divider orientation='horizontal'/>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{py: 1, color: 'gray'}}>Asset</TableCell>
            <TableCell sx={{py: 1, color: 'gray'}} align="right">APY</TableCell>
            <TableCell sx={{py: 1, color: 'gray'}} align="right">Supplied Bal.</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          { tokens.map((tokenData) => {
            return (
              <TableRow hover={true} key={tokenData.address} onClick={(event) => {handleRowClick(tokenData)}}>
                <TableCell sx={{py: 3}}>{tokenData.name}</TableCell>
                <TableCell sx={{py: 3}} align="right">15%</TableCell>
                <TableCell sx={{py: 3}} align="right">
                  {`${utils.formatEther(tokenData.balance.sub(tokenData.balance.mod(1e12)))} ${tokenData.symbol}`}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <SupplyDialog onClose={handleDialogClose} open={open} token={tokenToDialog}/>
    </TableContainer>
  )
}