import { Alert, AppBar, Box, Button, IconButton, Link, Menu, MenuItem, Stack, Toolbar, Typography } from '@mui/material'
import { ConnectButton } from '@web3uikit/web3'
import { useEffect, useState } from 'react'
import { useMoralis } from "react-moralis"
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import GitHubIcon from '@mui/icons-material/GitHub'
import MenuIcon from '@mui/icons-material/Menu'

export default function Header() {
  
	const { chainId, account } = useMoralis()
	const [navMenuOpen, setNavMenuOpen] = useState(false)

	const handleOpenNavMenu = () => {
		setNavMenuOpen(true)
	}

	const handleCloseNavMenu = () => {
		setNavMenuOpen(false)
	}
		
  return (
		<>
    <AppBar
			position="static"
			sx={{backgroundColor: "#00D4D4"}}
		>
			{ chainId !== null && chainId !== '0x5' &&
				<Alert
					variant='filled'
					severity='warning'
					sx={{justifyContent: 'center', borderRadius: 0}}
				>
					Switch to LocalDev chain
				</Alert>
			}
				<Toolbar>
					<Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
            <IconButton
              size="large"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleOpenNavMenu}
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              keepMounted
              transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
              }}
              open={navMenuOpen}
              onClose={handleCloseNavMenu}
              sx={{
                display: { xs: 'block', md: 'none' },
              }}
            >
							<MenuItem onClick={handleCloseNavMenu}>
								<Link
									href="https://freewillswap.vercel.app/"
									underline="hover"
									sx={{color: '#00D4D4'}}
									target='_blank'
									rel="noopener"
								>
									FreeWill Swap(DEX)
								</Link>
							</MenuItem>
							<MenuItem onClick={handleCloseNavMenu}>
								<Link
									href="https://github.com/SaTiSH-K-R/FreeWillFinance"
									underline="hover"
									sx={{color: '#00D4D4'}}
									target='_blank'
									rel="noopener"
								>
									<Stack direction='row'>
										<Typography>Github Repo</Typography>
										<GitHubIcon />
									</Stack>
								</Link>
							</MenuItem>
							<MenuItem onClick={handleCloseNavMenu}>
								<Link
									href="https://www.linkedin.com/in/SatishKR1/"
									underline="hover"
									sx={{color: '#00D4D4'}}
									target='_blank'
									rel="noopener"
									aria-label='See my Profile'
								>
									 <Stack direction='row'>
										<Typography>LinkedIn</Typography>
										<LinkedInIcon />
									</Stack>
								</Link>
							</MenuItem>
							<MenuItem onClick={handleCloseNavMenu}>
								<Link
									href="https://goerlifaucet.com/"
									underline="hover"
									sx={{color: '#00D4D4'}}
									target='_blank'
									rel="noopener"
								>
									Goerli Faucet
								</Link>
							</MenuItem>
            </Menu>
          </Box>
					<Typography
						variant="h5"
						component="div"
						sx={{ flexGrow: 1, color: "white", display: { xs: 'none', md: 'block' } }}
					>
						Freewill Finance
					</Typography>
					<Stack
						spacing={3}
						direction='row'
						sx={{
							display: { xs: 'none', md: 'flex' },
							mr: 2
						}}
					>
						<Link
							href="https://github.com/SaTiSH-K-R/FreeWillFinance"
							underline="hover"
							sx={{color: 'white'}}
							target='_blank'
							rel="noopener"
						>
							<Stack direction='row'>
								<Typography>Github Repo</Typography>
								<GitHubIcon />
							</Stack>
						</Link>
						<Link
							href="https://www.linkedin.com/in/SatishKR1/"
							underline="hover"
							sx={{color: 'white'}}
							target='_blank'
							rel="noopener"
							aria-label='See my Profile'
						>
							<Stack direction='row'>
								<Typography>LinkedIn</Typography>
								<LinkedInIcon />
							</Stack>
						</Link>
						<Link
							href="https://freewillswap.vercel.app/"
							underline="hover"
							sx={{color: 'white'}}
							target='_blank'
							rel="noopener"
						>
							FreeWill Swap(DEX)
						</Link>
						<Link
							href="https://goerlifaucet.com/"
							underline="hover"
							sx={{color: 'white'}}
							target='_blank'
							rel="noopener"
						>
							Goerli Faucet
						</Link>
					</Stack>
					<ConnectButton moralisAuth={false} />
				</Toolbar>  
    </AppBar>
		</>
  )
}