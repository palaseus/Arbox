import { ethers, network } from "hardhat";

export async function fundAndApprove(
  tokenAddress: string,
  whale: string,
  recipient: string,
  routers: string[],
  amount: bigint
) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whale],
  });
  const whaleSigner = await ethers.provider.getSigner(whale);
  const token = await ethers.getContractAt("IERC20", tokenAddress);

  // Transfer tokens to recipient (arbitrage contract)
  await token.connect(whaleSigner).transfer(recipient, amount);

  // Approve all routers to spend tokens from recipient
  for (const router of routers) {
    await token.connect(whaleSigner).approve(router, amount);
  }
} 