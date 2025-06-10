import { ethers } from "hardhat";

export function encodeSushiPath(path: string[]): string {
  // Sushi expects abi-encoded address[]
  return ethers.AbiCoder.defaultAbiCoder().encode(["address[]"], [path]);
} 