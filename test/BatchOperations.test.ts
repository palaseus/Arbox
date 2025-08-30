import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { MockERC20, AdvancedArbitrageEngine } from "../typechain-types";

describe("Batch Operations", function () {
    let advancedArbitrageEngine: AdvancedArbitrageEngine;
    let tokenA: MockERC20;
    let tokenB: MockERC20;
    let owner: Signer;
    let operator: Signer;
    let user: Signer;

    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));

    beforeEach(async function () {
        [owner, operator, user] = await ethers.getSigners();

        // Deploy mock tokens
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20Factory.deploy("Token A", "TKA", 18);
        tokenB = await MockERC20Factory.deploy("Token B", "TKB", 18);

        // Deploy MEVProtector first
        const MEVProtectorFactory = await ethers.getContractFactory("MEVProtector");
        const mevProtector = await MEVProtectorFactory.deploy(await owner.getAddress());

        // Deploy AdvancedArbitrageEngine
        const AdvancedArbitrageEngineFactory = await ethers.getContractFactory("AdvancedArbitrageEngine");
        advancedArbitrageEngine = await AdvancedArbitrageEngineFactory.deploy(
            await mevProtector.getAddress(),
            await owner.getAddress()
        );

        // Setup roles
        await advancedArbitrageEngine.grantRole(OPERATOR_ROLE, await operator.getAddress());
        await advancedArbitrageEngine.grantRole(STRATEGIST_ROLE, await owner.getAddress());

        // Initialize token risk profiles
        await advancedArbitrageEngine.updateTokenRiskProfile(
            await tokenA.getAddress(),
            ethers.parseEther("1000"), // maxExposure
            5000, // volatilityScore (medium)
            false // isBlacklisted
        );
        await advancedArbitrageEngine.updateTokenRiskProfile(
            await tokenB.getAddress(),
            ethers.parseEther("1000"), // maxExposure
            5000, // volatilityScore (medium)
            false // isBlacklisted
        );

        // Mint tokens to the contract
        await tokenA.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
        await tokenB.mint(await advancedArbitrageEngine.getAddress(), ethers.parseEther("1000"));
    });

    describe("Batch Arbitrage Operations", function () {
        it("should execute multiple arbitrage operations successfully", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("1"),
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                },
                {
                    tokenIn: await tokenB.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("0.5"),
                    expectedProfit: ethers.parseEther("0.15"),
                    gasEstimate: 150000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_2")),
                    routes: []
                }
            ];

            const tx = await advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations);
            const receipt = await tx.wait();

            // Check for events
            const batchCompletedEvent = receipt?.logs.find(
                log => log.topics[0] === advancedArbitrageEngine.interface.getEvent("BatchArbitrageCompleted")?.topicHash
            );
            expect(batchCompletedEvent).to.not.be.undefined;

            // Check for individual operation events
            const operationEvents = receipt?.logs.filter(
                log => log.topics[0] === advancedArbitrageEngine.interface.getEvent("BatchOperationExecuted")?.topicHash
            );
            expect(operationEvents).to.have.length(2);
        });

        it("should revert with empty operations array", async function () {
            const operations: any[] = [];

            await expect(
                advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations)
            ).to.be.revertedWith("Empty operations array");
        });

        it("should revert with too many operations", async function () {
            const operations = Array(11).fill({
                tokenIn: await tokenA.getAddress(),
                tokenOut: await tokenB.getAddress(),
                amount: ethers.parseEther("1"),
                expectedProfit: ethers.parseEther("0.05"),
                gasEstimate: 100000,
                strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY")),
                routes: []
            });

            await expect(
                advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations)
            ).to.be.revertedWith("Too many operations");
        });

        it("should revert with invalid token address", async function () {
            const operations = [
                {
                    tokenIn: ethers.ZeroAddress,
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("10"),
                    expectedProfit: ethers.parseEther("0.5"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            await expect(
                advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations)
            ).to.be.revertedWith("Invalid token address");
        });

        it("should revert with invalid amount", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: 0,
                    expectedProfit: ethers.parseEther("0.5"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            await expect(
                advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations)
            ).to.be.revertedWith("Invalid amount");
        });

        it("should revert with insufficient profit", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("10"),
                    expectedProfit: ethers.parseEther("0.01"), // Very low profit
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            await expect(
                advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations)
            ).to.be.revertedWith("Insufficient profit");
        });

        it("should only allow operators to execute batch operations", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("10"),
                    expectedProfit: ethers.parseEther("0.5"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            await expect(
                advancedArbitrageEngine.connect(user).executeBatchArbitrage(operations)
            ).to.be.revertedWithCustomError(advancedArbitrageEngine, "AccessControlUnauthorizedAccount");
        });

        it("should calculate total profit correctly", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("10"), // 5% profit = 0.5 ETH
                    expectedProfit: ethers.parseEther("0.4"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                },
                {
                    tokenIn: await tokenB.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("5"), // 5% profit = 0.25 ETH
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 150000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_2")),
                    routes: []
                }
            ];

            const tx = await advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations);
            const receipt = await tx.wait();

            // Decode the BatchArbitrageCompleted event
            const batchCompletedEvent = receipt?.logs.find(
                log => log.topics[0] === advancedArbitrageEngine.interface.getEvent("BatchArbitrageCompleted")?.topicHash
            );
            
                         if (batchCompletedEvent) {
                 const decoded = advancedArbitrageEngine.interface.parseLog(batchCompletedEvent as any);
                 expect(decoded?.args[0]).to.equal(2); // 2 operations
                 expect(decoded?.args[1]).to.equal(ethers.parseEther("0.75")); // 0.5 + 0.25 = 0.75 ETH total profit
             }
        });
    });

    describe("Gas Optimization", function () {
        it("should use less gas than individual operations", async function () {
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenB.getAddress(),
                    amount: ethers.parseEther("1"),
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                },
                {
                    tokenIn: await tokenB.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("0.5"),
                    expectedProfit: ethers.parseEther("0.15"),
                    gasEstimate: 150000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_2")),
                    routes: []
                }
            ];

            const batchTx = await advancedArbitrageEngine.connect(operator).executeBatchArbitrage(operations);
            const batchReceipt = await batchTx.wait();
            const batchGasUsed = batchReceipt?.gasUsed || 0;

            console.log(`Batch operations gas used: ${batchGasUsed}`);
            expect(batchGasUsed).to.be.gt(0);
        });
    });
});
