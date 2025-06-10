import { ethers } from "hardhat";

async function main() {
  const AAVE_POOL_ADDR_PROVIDER = "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb";
  const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

  // Step 1: Get implementation address from storage slot
  const implAddress = await ethers.provider.getStorage(
    AAVE_POOL_ADDR_PROVIDER,
    IMPLEMENTATION_SLOT
  );
  console.log("Raw implementation address:", implAddress);
  
  // Strip padding to get proper address
  const cleanImplAddress = "0x" + implAddress.slice(-40);
  console.log("Clean implementation address:", cleanImplAddress);

  // Step 2: Check if implementation has code
  const bytecode = await ethers.provider.getCode(cleanImplAddress);
  console.log("Implementation bytecode exists:", bytecode !== "0x");
  console.log("Bytecode prefix:", bytecode.slice(0, 10));

  // Step 3: Try calling getPool() on implementation
  const iface = new ethers.Interface([
    "function getPool() external view returns (address)"
  ]);

  try {
    const result = await ethers.provider.call({
      to: cleanImplAddress,
      data: iface.encodeFunctionData("getPool", [])
    });
    const decoded = iface.decodeFunctionResult("getPool", result);
    console.log("getPool() returned:", decoded[0]);
  } catch (err) {
    console.error("getPool() call failed:", err);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 