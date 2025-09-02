import { ethers } from "hardhat";
import { AdvancedArbitrageEngine, MEVProtector } from "../typechain-types";

async function main() {
  console.log("🚀 Setting up Real Testnet Testing Environment...\n");

  // Testnet token addresses (Sepolia)
  const TOKENS = {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    DAI: "0x68194a729C2450ad26072b3D33ADaCbcef39D574",
    LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789"
  };

  // DEX addresses (Sepolia)
  const DEXES = {
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V3_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
    SUSHISWAP_ROUTER: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"
  };

  console.log("📋 Testnet Configuration:");
  console.log("Network: Sepolia (Chain ID: 11155111)");
  console.log("RPC: https://sepolia.infura.io/v3/YOUR_KEY\n");

  console.log("🪙 Token Addresses:");
  Object.entries(TOKENS).forEach(([symbol, address]) => {
    console.log(`  ${symbol}: ${address}`);
  });

  console.log("\n🏪 DEX Addresses:");
  Object.entries(DEXES).forEach(([name, address]) => {
    console.log(`  ${name}: ${address}`);
  });

  // Validate network connection
  try {
    const network = await ethers.provider.getNetwork();
    console.log(`\n✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
    
    if (network.chainId !== 11155111n) {
      console.log("⚠️  Warning: Not connected to Sepolia testnet!");
      console.log("   Run: npx hardhat run scripts/testnet-setup.ts --network sepolia");
      return;
    }
  } catch (error) {
    console.log("❌ Failed to connect to network:", error);
    return;
  }

  // Check deployer balance
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`\n💰 Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  if (balance < ethers.parseEther("0.01")) {
    console.log("⚠️  Warning: Low balance! Get testnet ETH from:");
    console.log("   https://sepoliafaucet.com/");
    console.log("   https://faucet.sepolia.dev/");
  }

  // Validate token contracts
  console.log("\n🔍 Validating Token Contracts...");
  for (const [symbol, address] of Object.entries(TOKENS)) {
    try {
      const code = await ethers.provider.getCode(address);
      if (code === "0x") {
        console.log(`  ❌ ${symbol}: Not a contract`);
      } else {
        console.log(`  ✅ ${symbol}: Valid contract`);
      }
    } catch (error) {
      console.log(`  ❌ ${symbol}: Error checking contract`);
    }
  }

  console.log("\n🎯 Next Steps:");
  console.log("1. Set your PRIVATE_KEY in .env file");
  console.log("2. Set your INFURA_KEY in .env file");
  console.log("3. Run: npx hardhat run scripts/deploy-testnet.ts --network sepolia");
  console.log("4. Run: npx hardhat run scripts/real-market-test.ts --network sepolia");
}

main().catch((error) => {
  console.error("❌ Setup failed:", error);
  process.exit(1);
});
