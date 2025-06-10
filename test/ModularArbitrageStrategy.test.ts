import { expect } from "chai";
import { ethers } from "hardhat";
import { ModularArbitrageStrategy } from "../typechain-types/contracts/ModularArbitrageStrategy";
import * as fs from 'fs';
import * as path from 'path';

// Ensure typechain types are generated
import "../typechain-types";

describe("Modular Arbitrage Strategy Gas Profiling", function () {
    let strategy: ModularArbitrageStrategy;

    before(async function () {
        const StrategyF = await ethers.getContractFactory("ModularArbitrageStrategy");
        strategy = await StrategyF.deploy() as ModularArbitrageStrategy;
        await strategy.waitForDeployment();
    });

    it("should profile gas for executeStrategy", async function () {
        const tx = await strategy.executeStrategy();
        const receipt = await tx.wait();
        const gasUsed = Number(receipt.gasUsed);
        console.log("\n=== Modular Arbitrage Strategy Gas Profiling ===");
        console.log(`Gas Used for executeStrategy: ${gasUsed}`);
        // Output to JSON
        const outputDir = path.join(__dirname, 'results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        const outputPath = path.join(outputDir, 'modular_arbitrage_strategy_gas_profiling.json');
        fs.writeFileSync(outputPath, JSON.stringify({ gasUsed }, null, 2));
        console.log(`Results saved to ${outputPath}`);
    });
}); 