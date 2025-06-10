import { expect } from "chai";
import { ethers } from "hardhat";
import { config } from "../test/config/arbitrage.config";
import { FlashLoanArbitrage } from "../typechain-types/contracts/FlashLoanArbitrage";
import { EntryPoint } from "../typechain-types/contracts/EntryPoint";
import { Account } from "../typechain-types/contracts/Account";
import { BaseContract } from "ethers";
import { Wallet } from "ethers";
import { Paymaster } from "../typechain-types/contracts/Paymaster";
import * as fs from 'fs';
import * as path from 'path';

let owner: any; // Ensure owner is accessible to all tests

describe("Gas Profiling", function () {
    let arbitrage: FlashLoanArbitrage;
    let entryPoint: EntryPoint;
    let account: Account;
    let weth: BaseContract;
    let usdc: BaseContract;
    let userWallet: Wallet;
    const uniswapRouterAddress = config.routers.UNISWAP_V3.address;
    const sushiswapRouterAddress = config.routers.SUSHISWAP.address;
    const wethAddress = config.tokens.WETH.address;
    const usdcAddress = config.tokens.USDC.address;

    before(async function () {
        [owner] = await ethers.getSigners();

        // Create a wallet with a known private key for testing
        const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        userWallet = new Wallet(privateKey, ethers.provider);

        // Deploy EntryPoint
        const EntryPointF = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPointF.deploy() as EntryPoint;
        await entryPoint.waitForDeployment();

        // Deploy Account
        const AccountF = await ethers.getContractFactory("Account");
        account = await AccountF.deploy(userWallet.address, await entryPoint.getAddress()) as Account;
        await account.waitForDeployment();

        // Deploy Arbitrage
        const ArbitrageF = await ethers.getContractFactory("FlashLoanArbitrage");
        arbitrage = await ArbitrageF.deploy(
            config.aave.POOL_ADDRESSES_PROVIDER,
            owner.address,
            config.testParams.minProfit.toString(),
            50, // minProfitPercentage (0.5%)
            100, // maxSlippage (1%)
            ethers.parseUnits("100", "gwei") // maxGasPrice
        ) as FlashLoanArbitrage;
        await arbitrage.waitForDeployment();

        // Get token contracts
        weth = await ethers.getContractAt("IERC20", config.tokens.WETH.address);
        usdc = await ethers.getContractAt("IERC20", config.tokens.USDC.address);

        // Register routers
        await arbitrage.addRouter(uniswapRouterAddress, uniswapRouterAddress);
        await arbitrage.addRouter(sushiswapRouterAddress, sushiswapRouterAddress);
    });

    describe("Gas Usage Analysis", function () {
        it("should track gas usage at each step of arbitrage execution", async function () {
            const amount = ethers.parseEther("1");
            const routes = [
                {
                    router: uniswapRouterAddress,
                    tokenIn: wethAddress,
                    tokenOut: usdcAddress,
                    amountIn: amount,
                    minAmountOut: 0,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [wethAddress, 3000, usdcAddress]),
                    fee: 3000
                },
                {
                    router: sushiswapRouterAddress,
                    tokenIn: usdcAddress,
                    tokenOut: wethAddress,
                    amountIn: 0,
                    minAmountOut: amount,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [usdcAddress, 3000, wethAddress]),
                    fee: 3000
                }
            ];

            // Create user operation
            const userOp = {
                sender: await account.getAddress(),
                nonce: await account.getNonce(),
                initCode: "0x",
                callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                    wethAddress,
                    amount,
                    routes,
                    config.testParams.minProfit.toString()
                ]),
                callGasLimit: 10000000,
                verificationGasLimit: 10000000,
                preVerificationGas: 10000000,
                maxFeePerGas: ethers.parseUnits("100", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
                paymasterAndData: "0x",
                signature: "0x"
            };

            // Get user operation hash and sign it
            const userOpHash = await entryPoint.getUserOpHash(userOp);
            const userOpHashBytes = ethers.getBytes(userOpHash);
            const signature = await userWallet.signMessage(userOpHashBytes);
            userOp.signature = signature;

            // Execute user operation
            const tx = await entryPoint.handleOps(userOp, owner.address);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction failed");
            
            // Parse and analyze gas checkpoints
            const gasCheckpoints: { [key: string]: number } = {};
            const swapEvents: { [key: string]: { in: bigint, out: bigint } } = {};
            
            for (const log of receipt.logs) {
                try {
                    const parsed = arbitrage.interface.parseLog(log);
                    if (!parsed) continue;
                    
                    if (parsed.name === "GasCheckpoint") {
                        gasCheckpoints[parsed.args.label] = Number(parsed.args.gasLeft);
                    }
                    
                    if (parsed.name === "SwapExecuted") {
                        swapEvents[parsed.args.router] = {
                            in: parsed.args.amountIn,
                            out: parsed.args.amountOut
                        };
                    }
                } catch (e) {
                    // Skip logs that aren't from our contract
                }
            }

            // Calculate gas usage between checkpoints
            const gasUsage: { [key: string]: number } = {};
            const checkpoints = Object.entries(gasCheckpoints);
            
            for (let i = 0; i < checkpoints.length - 1; i++) {
                const [label, gasLeft] = checkpoints[i];
                const [nextLabel, nextGasLeft] = checkpoints[i + 1];
                gasUsage[`${label}_to_${nextLabel}`] = gasLeft - nextGasLeft;
            }

            // Log detailed gas analysis
            console.log("\n=== Gas Usage Analysis ===");
            console.log("\nGas Usage Between Checkpoints:");
            Object.entries(gasUsage).forEach(([step, gas]) => {
                console.log(`${step}: ${gas} gas`);
            });

            console.log("\nSwap Performance:");
            Object.entries(swapEvents).forEach(([router, amounts]) => {
                console.log(`${router}:`);
                console.log(`  Input: ${ethers.formatEther(amounts.in)} WETH`);
                console.log(`  Output: ${ethers.formatEther(amounts.out)} WETH`);
            });

            // Verify no step exceeds reasonable gas limits
            const MAX_GAS_PER_STEP = 1000000; // 1M gas per step
            Object.entries(gasUsage).forEach(([step, gas]) => {
                expect(gas).to.be.below(MAX_GAS_PER_STEP, `Step ${step} exceeded gas limit`);
            });
        });

        it("should handle maximum route length efficiently", async function () {
            const amount = ethers.parseEther("1");
            const routes = [
                {
                    router: uniswapRouterAddress,
                    tokenIn: wethAddress,
                    tokenOut: usdcAddress,
                    amountIn: amount,
                    minAmountOut: 0,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [wethAddress, 3000, usdcAddress]),
                    fee: 3000
                },
                {
                    router: sushiswapRouterAddress,
                    tokenIn: usdcAddress,
                    tokenOut: wethAddress,
                    amountIn: 0,
                    minAmountOut: amount,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [usdcAddress, 3000, wethAddress]),
                    fee: 3000
                }
            ];

            // Create user operation
            const userOp = {
                sender: await account.getAddress(),
                nonce: await account.getNonce(),
                initCode: "0x",
                callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                    wethAddress,
                    amount,
                    routes,
                    config.testParams.minProfit.toString()
                ]),
                callGasLimit: 10000000,
                verificationGasLimit: 10000000,
                preVerificationGas: 10000000,
                maxFeePerGas: ethers.parseUnits("100", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
                paymasterAndData: "0x",
                signature: "0x"
            };

            // Get user operation hash and sign it
            const userOpHash = await entryPoint.getUserOpHash(userOp);
            const userOpHashBytes = ethers.getBytes(userOpHash);
            const signature = await userWallet.signMessage(userOpHashBytes);
            userOp.signature = signature;

            // Execute user operation
            const tx = await entryPoint.handleOps(userOp, owner.address);
            const receipt = await tx.wait();
            if (!receipt) throw new Error("Transaction failed");

            // Calculate total gas used
            const totalGasUsed = Number(receipt.gasUsed);
            console.log("\n=== Maximum Route Length Test ===");
            console.log(`Total Gas Used: ${totalGasUsed}`);

            // Verify gas usage is within acceptable limits
            const MAX_TOTAL_GAS = 5000000; // 5M gas total
            expect(totalGasUsed).to.be.below(MAX_TOTAL_GAS, "Total gas usage exceeded limit");
        });

        it("should maintain consistent gas usage across multiple executions", async function () {
            const amount = ethers.parseEther("1");
            const routes = [
                {
                    router: uniswapRouterAddress,
                    tokenIn: wethAddress,
                    tokenOut: usdcAddress,
                    amountIn: amount,
                    minAmountOut: 0,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [wethAddress, 3000, usdcAddress]),
                    fee: 3000
                },
                {
                    router: sushiswapRouterAddress,
                    tokenIn: usdcAddress,
                    tokenOut: wethAddress,
                    amountIn: 0,
                    minAmountOut: amount,
                    path: ethers.solidityPacked([
                        "address", "uint24", "address"
                    ], [usdcAddress, 3000, wethAddress]),
                    fee: 3000
                }
            ];

            // Execute multiple times and compare gas usage
            const gasUsages: number[] = [];
            const NUM_EXECUTIONS = 3;

            for (let i = 0; i < NUM_EXECUTIONS; i++) {
                // Create user operation
                const userOp = {
                    sender: await account.getAddress(),
                    nonce: await account.getNonce(),
                    initCode: "0x",
                    callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                        wethAddress,
                        amount,
                        routes,
                        config.testParams.minProfit.toString()
                    ]),
                    callGasLimit: 10000000,
                    verificationGasLimit: 10000000,
                    preVerificationGas: 10000000,
                    maxFeePerGas: ethers.parseUnits("100", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
                    paymasterAndData: "0x",
                    signature: "0x"
                };

                // Get user operation hash and sign it
                const userOpHash = await entryPoint.getUserOpHash(userOp);
                const userOpHashBytes = ethers.getBytes(userOpHash);
                const signature = await userWallet.signMessage(userOpHashBytes);
                userOp.signature = signature;

                // Execute user operation
                const tx = await entryPoint.handleOps(userOp, owner.address);
                const receipt = await tx.wait();
                if (!receipt) throw new Error("Transaction failed");
                gasUsages.push(Number(receipt.gasUsed));
            }

            console.log("\n=== Gas Usage Consistency Test ===");
            console.log("Gas Usage Across Executions:", gasUsages);

            // Calculate variance in gas usage
            const avg = gasUsages.reduce((a, b) => a + b) / gasUsages.length;
            const variance = gasUsages.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / gasUsages.length;
            
            console.log(`Average Gas Usage: ${avg}`);
            console.log(`Variance: ${variance}`);

            // Verify consistent gas usage (variance should be small)
            const MAX_VARIANCE = 100000; // 100K gas variance
            expect(variance).to.be.below(MAX_VARIANCE, "Gas usage is not consistent across executions");
        });
    });
});

describe("Paymaster Gas Profiling", function () {
    let paymaster: Paymaster;
    before(async function () {
        const PaymasterF = await ethers.getContractFactory("Paymaster");
        paymaster = await PaymasterF.deploy() as Paymaster;
        await paymaster.waitForDeployment();
        // Fund paymaster for validation
        await paymaster.deposit({ value: ethers.parseEther("1") });
        // Allow the owner account
        await paymaster.allowAccount(owner.address);
        // Directly set the Paymaster contract's balance
        await ethers.provider.send("hardhat_setBalance", [await paymaster.getAddress(), "0xde0b6b3a7640000"]); // 1 ETH
    });

    it("should profile gas for validatePaymasterUserOp", async function () {
        // Prepare a dummy userOp struct with correct types
        const userOp = {
            sender: owner.address,
            nonce: 0n,
            initCode: "0x",
            callData: "0x",
            callGasLimit: 100000n,
            verificationGasLimit: 100000n,
            preVerificationGas: 100000n,
            maxFeePerGas: ethers.parseUnits("100", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
        // Profile gas for validation
        const tx = await paymaster.validatePaymasterUserOp(
            userOp,
            ethers.ZeroHash, // dummy bytes32
            ethers.parseEther("0.01")
        );
        const receipt = await tx.wait();
        const gasUsed = Number(receipt.gasUsed);
        console.log("\n=== Paymaster Gas Profiling ===");
        console.log(`Gas Used for validatePaymasterUserOp: ${gasUsed}`);
        // Output to JSON
        const outputDir = path.join(__dirname, 'results');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
        const outputPath = path.join(outputDir, 'paymaster_gas_profiling.json');
        fs.writeFileSync(outputPath, JSON.stringify({ gasUsed }, null, 2));
        console.log(`Results saved to ${outputPath}`);
    });
}); 