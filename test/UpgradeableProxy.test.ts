import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { 
    AdvancedArbitrageEngine, 
    ArbitrageEngineProxy, 
    ArbitrageEngineProxyAdmin,
    MockERC20,
    MEVProtector 
} from "../typechain-types";

describe("Upgradeable Proxy", function () {
    let implementation: AdvancedArbitrageEngine;
    let proxy: ArbitrageEngineProxy;
    let proxyAdmin: ArbitrageEngineProxyAdmin;
    let mevProtector: MEVProtector;
    let tokenA: MockERC20;
    let owner: Signer;
    let operator: Signer;
    let user: Signer;

    const OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("OPERATOR_ROLE"));
    const STRATEGIST_ROLE = ethers.keccak256(ethers.toUtf8Bytes("STRATEGIST_ROLE"));

    beforeEach(async function () {
        [owner, operator, user] = await ethers.getSigners();

        // Deploy mock contracts
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        tokenA = await MockERC20Factory.deploy("Token A", "TKA", 18);

        const MEVProtectorFactory = await ethers.getContractFactory("MEVProtector");
        mevProtector = await MEVProtectorFactory.deploy(await owner.getAddress());

        // Deploy implementation
        const AdvancedArbitrageEngineFactory = await ethers.getContractFactory("AdvancedArbitrageEngine");
        implementation = await AdvancedArbitrageEngineFactory.deploy(
            await mevProtector.getAddress(),
            await owner.getAddress()
        );

        // Deploy proxy admin
        const ArbitrageEngineProxyAdminFactory = await ethers.getContractFactory("ArbitrageEngineProxyAdmin");
        proxyAdmin = await ArbitrageEngineProxyAdminFactory.deploy(await owner.getAddress());

        // Deploy proxy
        const ArbitrageEngineProxyFactory = await ethers.getContractFactory("ArbitrageEngineProxy");
        const initData = implementation.interface.encodeFunctionData("initialize", [
            await mevProtector.getAddress(),
            await owner.getAddress()
        ]);
        proxy = await ArbitrageEngineProxyFactory.deploy(
            await implementation.getAddress(),
            initData
        );

        // Setup roles on the proxy
        const proxyContract = implementation.attach(await proxy.getAddress());
        await proxyContract.grantRole(OPERATOR_ROLE, await operator.getAddress());
        await proxyContract.grantRole(STRATEGIST_ROLE, await owner.getAddress());

        // Initialize token risk profiles
        await proxyContract.updateTokenRiskProfile(
            await tokenA.getAddress(),
            ethers.parseEther("1000"),
            5000,
            false
        );

        // Mint tokens to the proxy
        await tokenA.mint(await proxy.getAddress(), ethers.parseEther("1000"));
    });

    describe("Proxy Deployment", function () {
        it("should initialize with correct parameters", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            const riskParams = await proxyContract.getRiskParams();
            expect(riskParams.maxExposurePerToken).to.equal(ethers.parseEther("1000"));
        });
    });

    describe("Proxy Functionality", function () {
        it("should execute arbitrage through proxy", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("1"),
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            const tx = await proxyContract.connect(operator).executeBatchArbitrage(operations);
            const receipt = await tx.wait();

            // Check for events
            const batchCompletedEvent = receipt?.logs.find(
                log => log.topics[0] === proxyContract.interface.getEvent("BatchArbitrageCompleted")?.topicHash
            );
            expect(batchCompletedEvent).to.not.be.undefined;
        });

        it("should maintain state across proxy calls", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("1"),
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            await proxyContract.connect(operator).executeBatchArbitrage(operations);
            
            const metrics = await proxyContract.getGlobalMetrics();
            expect(metrics[0]).to.be.gt(0); // totalProfit should be greater than 0
        });
    });

    describe("Proxy Upgrade", function () {
        it("should only allow authorized upgrades", async function () {
            const AdvancedArbitrageEngineFactory = await ethers.getContractFactory("AdvancedArbitrageEngine");
            const newImplementation = await AdvancedArbitrageEngineFactory.deploy(
                await mevProtector.getAddress(),
                await owner.getAddress()
            );

            // Try to upgrade with unauthorized user
            await expect(
                proxyAdmin.connect(user).upgrade(await proxy.getAddress(), await newImplementation.getAddress())
            ).to.be.revertedWithCustomError(proxyAdmin, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Proxy Admin Management", function () {
        it("should only allow admin to change proxy admin", async function () {
            const newAdmin = await user.getAddress();
            
            await expect(
                proxyAdmin.connect(user).changeProxyAdmin(await proxy.getAddress(), newAdmin)
            ).to.be.revertedWithCustomError(proxyAdmin, "AccessControlUnauthorizedAccount");
        });
    });

    describe("Version Management", function () {
        it("should return correct version", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            const version = await proxyContract.getVersion();
            expect(version).to.equal("1.0.0");
        });

        it("should indicate upgradeability", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            const isUpgradeable = await proxyContract.isUpgradeable();
            expect(isUpgradeable).to.be.true;
        });
    });

    describe("Gas Optimization", function () {
        it("should use reasonable gas for proxy operations", async function () {
            const proxyContract = implementation.attach(await proxy.getAddress());
            
            const operations = [
                {
                    tokenIn: await tokenA.getAddress(),
                    tokenOut: await tokenA.getAddress(),
                    amount: ethers.parseEther("1"),
                    expectedProfit: ethers.parseEther("0.2"),
                    gasEstimate: 200000,
                    strategyId: ethers.keccak256(ethers.toUtf8Bytes("STRATEGY_1")),
                    routes: []
                }
            ];

            const tx = await proxyContract.connect(operator).executeBatchArbitrage(operations);
            const receipt = await tx.wait();
            const gasUsed = receipt?.gasUsed || 0;

            console.log(`Proxy batch operation gas used: ${gasUsed}`);
            expect(gasUsed).to.be.gt(0);
            expect(gasUsed).to.be.lt(200000); // Should be reasonable
        });
    });
});
