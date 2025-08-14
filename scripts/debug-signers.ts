import { ethers } from "hardhat";

async function main() {
  console.log("🔍 Debugging Signers...");
  
  try {
    const signers = await ethers.getSigners();
    console.log("Number of signers:", signers.length);
    
    for (let i = 0; i < Math.min(5, signers.length); i++) {
      const signer = signers[i];
      if (signer) {
        const address = await signer.getAddress();
        console.log(`Signer ${i}:`, address);
      } else {
        console.log(`Signer ${i}: undefined`);
      }
    }
    
    if (signers.length >= 3) {
      console.log("✅ We have enough signers!");
    } else {
      console.log("❌ Not enough signers");
    }
    
  } catch (error) {
    console.error("Error getting signers:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Debug failed:", error);
    process.exit(1);
  });
