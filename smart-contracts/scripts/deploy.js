const { ethers } = require('hardhat')

const FUSD_ADDRESS = '0x9c37763Ec6Cf0E9C6a3Ff6312763a831EE97C4A7'

const FREE_WILL_SWAP_ADDRESS = '0x2Bd84eb5271fFE68bBE23AE6aE388424022754bc'

async function main() {
  const FEther = await ethers.getContractFactory('fEther')
  const fEther = await FEther.deploy()
  await fEther.deployed()
  console.log("fEther:: ",fEther.address)
  const FreeWillToken = await ethers.getContractFactory('FreeWillToken')
  const freeWillToken = await FreeWillToken.deploy()
  await freeWillToken.deployed()
  console.log("FreeWillToken:: ", freeWillToken.address)
  const FreeWill = await ethers.getContractFactory('FreeWill')
  const freeWill = await FreeWill.deploy(
    fEther.address,
    FUSD_ADDRESS,
    FREE_WILL_SWAP_ADDRESS,
    freeWillToken.address
  )
  await freeWill.deployed()
  
  console.log("FreeWill:: ", freeWill.address)
  const setMinterTx = await fEther.setMinter(freeWill.address)
  console.log(await setMinterTx.wait())
  const grantRoleTx = await freeWillToken.addMinterRole(freeWill.address)
  console.log(await grantRoleTx.wait())

  const fToken = await ethers.getContractFactory('fToken')
  const fFUSD = await fToken.deploy(
    'fFUSD',
    'fFUSD',
    FUSD_ADDRESS,
    freeWill.address
  )
  await fFUSD.deployed()
  const tx1 = await freeWill.addToken(FUSD_ADDRESS, fFUSD.address)
  const txr1 = await tx1.wait()
  console.log(txr1)
  const fFWT = await fToken.deploy(
    'fFWT',
    'fFWT',
    freeWillToken.address,
    freeWill.address
  )
  await fFWT.deployed()
  const tx2 = await freeWill.addToken(freeWillToken.address, fFWT.address)
  const txr2 = await tx2.wait()
  console.log(txr2)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
