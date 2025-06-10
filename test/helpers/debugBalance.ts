import { ethers } from "hardhat";

export async function debugBalance(tokenAddress: string, account: string, label: string) {
  const token = await ethers.getContractAt("IERC20", tokenAddress);
  const bal = await token.balanceOf(account);
  console.log(`${label} balance:`, ethers.formatUnits(bal, 18));
} 