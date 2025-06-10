import { ethers } from "hardhat";

async function main() {
  const providerAddress = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
  const abi = [
    "function getPool() external view returns (address)"
  ];
  const provider = await ethers.getContractAt(abi, providerAddress);
  try {
    const pool = await provider.getPool();
    console.log("getPool() returned:", pool);
  } catch (err) {
    console.error("Error calling getPool():", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 