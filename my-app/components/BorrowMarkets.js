import { Divider, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material"
import { BigNumber, utils } from "ethers"
import { useEffect, useState } from "react"
import BorrowDialog from "./BorrowDialog"
import { DataContext } from "../Contexts/DataContext"
import { useContext } from "react"

export default function BorrowMarkets() {

  const { tokens } = useContext(DataContext)
  const [open, setOpen] = useState(false)
  const [selectedTokenIndex, setSelectedTokenIndex] = useState(0)
  const [tokenToDialog, setTokenToDialog] = useState({
    name: '',
    symbol: '',
    address: '',
    borrowed: BigNumber.from(0),
    liquidity: BigNumber.from(0),
    unlocked: BigNumber.from(0),
    interestOwed: BigNumber.from(0)
  })

  useEffect(() => {
  }, [tokens])
  
  const handleRowClick = (index) => {
    setSelectedTokenIndex(index)
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
      <Typography variant='h6' p={2}>Borrow Markets</Typography>
      <Divider orientation='horizontal'/>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell sx={{py: 1, color: 'gray'}}>Asset</TableCell>
            <TableCell sx={{py: 1, color: 'gray'}} align="right">APY</TableCell>
            <TableCell sx={{py: 1, color: 'gray'}} align="right">Borrowed</TableCell>
            <TableCell sx={{py: 1, color: 'gray'}} align="right">Liquidity</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          { tokens.map((tokenData, index) => {
            return (
              <TableRow hover={true} key={tokenData.address} onClick={(event) => {
                console.log(JSON.parse(JSON.stringify(tokens)))
                handleRowClick(index)
              }}>
                <TableCell sx={{py: 3}}>{tokenData.name}</TableCell>
                <TableCell sx={{py: 3}} align="right">30%</TableCell>
                <TableCell sx={{py: 3}} align="right">
                  {`${utils.formatEther(tokenData.borrowed.sub(tokenData.borrowed.mod(1e12)))} ${tokenData.symbol}`}
                </TableCell>
                <TableCell sx={{py: 3}} align="right">
                  {`${utils.formatEther(tokenData.liquidity.sub(tokenData.liquidity.mod(1e12)))} ${tokenData.symbol}`}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <BorrowDialog
        onClose={handleDialogClose}
        open={open}
        tokenIndex={selectedTokenIndex}
      />
    </TableContainer>
  )
}