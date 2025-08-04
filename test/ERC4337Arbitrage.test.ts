import { expect } from "chai";
import { ethers } from "hardhat";
import { config } from "../test/config/arbitrage.config";
import { EntryPoint } from "../typechain-types/contracts/EntryPoint";
import { Account } from "../typechain-types/contracts/Account";
import { Paymaster } from "../typechain-types/contracts/Paymaster";
import { FlashLoanArbitrage } from "../typechain-types/contracts/FlashLoanArbitrage";
// import { IERC20 } from "../typechain-types/contracts/interfaces/IERC20";
import { BaseContract } from "ethers";
import { Signature } from "ethers";
import { Wallet, SigningKey } from "ethers";
// import { HardhatEthersSigner } from "hardhat";
import contractArtifact from "../artifacts/contracts/Account.sol/Account.json";
import { Interface } from "ethers";

describe("ERC-4337 Arbitrage", function () {
    let entryPoint: EntryPoint;
    let account: Account;
    let paymaster: Paymaster;
    let arbitrage: FlashLoanArbitrage;
    let owner: any;
    let user: any;
    let weth: BaseContract;
    let usdc: BaseContract;
    const uniswapRouterAddress = config.routers.UNISWAP_V3.address;
    const sushiswapRouterAddress = config.routers.SUSHISWAP.address;
    const wethAddress = config.tokens.WETH.address;
    const usdcAddress = config.tokens.USDC.address;
    
    let userWallet: Wallet;
    let signingKey: SigningKey;
    
    before(async function () {
        [owner, user] = await ethers.getSigners();
        
        // Create a wallet with a known private key for testing
        const privateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
        userWallet = new Wallet(privateKey, ethers.provider);
        signingKey = new SigningKey(privateKey);
        
        // Deploy EntryPoint
        const EntryPointF = await ethers.getContractFactory("EntryPoint");
        entryPoint = await EntryPointF.deploy() as EntryPoint;
        await entryPoint.waitForDeployment();
        
        // Deploy Account
        const AccountF = await ethers.getContractFactory("Account");
        account = await AccountF.deploy(userWallet.address, await entryPoint.getAddress()) as Account;
        await account.waitForDeployment();
        console.log("Test userWallet.address:", userWallet.address);
        const contractOwner = await account.owner();
        console.log("Account contract owner:", contractOwner);
        
        // Deploy Paymaster
        const PaymasterF = await ethers.getContractFactory("Paymaster");
        paymaster = await PaymasterF.deploy() as Paymaster;
        await paymaster.waitForDeployment();
        
        // Deploy mock Aave Pool
        const MockPool = await ethers.getContractFactory("MockAavePool");
        const mockPool = await MockPool.deploy();
        await mockPool.waitForDeployment();

        // Deploy mock PoolAddressesProvider
        const MockProvider = await ethers.getContractFactory("MockPoolAddressesProvider");
        const mockProvider = await MockProvider.deploy(await mockPool.getAddress());
        await mockProvider.waitForDeployment();

        // Deploy Arbitrage
        const ArbitrageF = await ethers.getContractFactory("FlashLoanArbitrage");
        arbitrage = await ArbitrageF.deploy(
            await mockProvider.getAddress(),
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
        
        // Register routers using config addresses (2 args only)
        await (arbitrage as any).addRouter(uniswapRouterAddress, uniswapRouterAddress);
        await (arbitrage as any).addRouter(sushiswapRouterAddress, sushiswapRouterAddress);
        
        // Allow account to use paymaster
        await paymaster.allowAccount(await account.getAddress());
        
        // Fund paymaster
        await paymaster.deposit({ value: ethers.parseEther("1") });
    });
    
    it("should execute arbitrage through account abstraction", async function () {
        const routes = [
            {
                router: uniswapRouterAddress,
                tokenIn: wethAddress,
                tokenOut: usdcAddress,
                amountIn: ethers.parseEther("1"),
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
                minAmountOut: ethers.parseEther("1"),
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
                ethers.parseEther("1"),
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
        
        // Get the Account contract's address
        const accountAddress = await account.getAddress();
        console.log("Account contract address:", accountAddress);
        
        // Get all events from the receipt
        const events = receipt.logs.map(log => {
            try {
                return account.interface.parseLog(log);
            } catch (e) {
                return null;
            }
        }).filter(event => event !== null);
        
        console.log("\nParsed Events:", events);
        
        // Find the DebugSignature event
        const debugEvent = events.find(event => event?.name === "DebugSignature");
        if (debugEvent) {
            console.log("\nDebugSignature event details:");
            console.log("userOpHash:", debugEvent.args.userOpHash);
            console.log("messageHash:", debugEvent.args.messageHash);
            console.log("recovered:", debugEvent.args.recovered);
            console.log("expectedOwner:", debugEvent.args.expectedOwner);
        } else {
            console.log("\nNo DebugSignature event found in logs");
        }

        // Find the DebugHashConstruction event
        const debugHashEvent = events.find(event => event?.name === "DebugHashConstruction");
        if (debugHashEvent) {
            console.log("\nDebugHashConstruction event details:");
            console.log("hash:", debugHashEvent.args.hash);
            console.log("prefix:", debugHashEvent.args.prefix);
            console.log("message:", debugHashEvent.args.message);
            console.log("prefixedMessage:", debugHashEvent.args.prefixedMessage);
            console.log("finalHash:", debugHashEvent.args.finalHash);
        } else {
            console.log("\nNo DebugHashConstruction event found in logs");
        }

        // Find the DebugRecover event
        const debugRecoverEvent = events.find(event => event?.name === "DebugRecover");
        if (debugRecoverEvent) {
            console.log("\nDebugRecover event details:");
            console.log("userOpHash:", debugRecoverEvent.args.userOpHash);
            console.log("prefixedHash:", debugRecoverEvent.args.prefixedHash);
            console.log("v:", debugRecoverEvent.args.v);
            console.log("r:", debugRecoverEvent.args.r);
            console.log("s:", debugRecoverEvent.args.s);
            console.log("recovered:", debugRecoverEvent.args.recovered);
        } else {
            console.log("\nNo DebugRecover event found in logs");
        }

        const contractRecovered = ethers.recoverAddress(userOpHash, signature);
        console.log("Recovered (test, contract logic):", contractRecovered);

        // Listen for DebugMessageHash event
        const debugMessageHashLog = events.find((event: any) => event?.name === "DebugMessageHash");
        if (debugMessageHashLog) {
            console.log("DebugMessageHash (contract):", debugMessageHashLog.args.messageHash);
        } else {
            console.log("No DebugMessageHash event found in logs");
        }

        // Find the DebugSplitSignature event
        const debugSplitEvent = events.find(event => event?.name === "DebugSplitSignature");
        if (debugSplitEvent) {
            console.log("\n[Contract] DebugSplitSignature event:");
            console.log("sig:", debugSplitEvent.args.sig);
            console.log("len:", debugSplitEvent.args.len);
            console.log("r:", debugSplitEvent.args.r);
            console.log("s:", debugSplitEvent.args.s);
            console.log("v:", debugSplitEvent.args.v);
        } else {
            console.log("\nNo DebugSplitSignature event found in logs");
        }

        if (receipt) {
          const iface = new Interface(contractArtifact.abi);
          for (const log of receipt.logs) {
            try {
              const parsed = iface.parseLog(log);
              if (parsed && parsed.name === "DebugSplitSignature") {
                console.log("[DEBUG] Contract emitted DebugSplitSignature:");
                console.log("r:", parsed.args.r);
                console.log("s:", parsed.args.s);
                console.log("v:", parsed.args.v);
              }
            } catch (err) {
              // Not all logs will parse — that's expected
            }
          }
        }
    });
    
    it("should fail with invalid signature", async function () {
        // Create user operation
        const routes = [
            {
                router: uniswapRouterAddress,
                tokenIn: wethAddress,
                tokenOut: usdcAddress,
                amountIn: ethers.parseEther("1"),
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
                minAmountOut: ethers.parseEther("1"),
                path: ethers.solidityPacked([
                    "address", "uint24", "address"
                ], [usdcAddress, 3000, wethAddress]),
                fee: 3000
            }
        ];
        const userOp = {
            sender: await account.getAddress(),
            nonce: await account.getNonce(),
            initCode: "0x",
            callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                wethAddress,
                ethers.parseEther("1"),
                routes,
                config.testParams.minProfit.toString()
            ]),
            callGasLimit: 1000000,
            verificationGasLimit: 1000000,
            preVerificationGas: 1000000,
            maxFeePerGas: ethers.parseUnits("100", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: ethers.solidityPacked(
                ["address", "bytes"],
                [await paymaster.getAddress(), "0x"]
            ),
            signature: "0x" + "0".repeat(130) // 65 zero bytes for invalid signature
        };
        await expect(entryPoint.handleOps(userOp, owner.address))
            .to.be.revertedWith("Invalid signature");
    });
    
    it("should fail when paymaster has insufficient balance", async function () {
        await paymaster.withdraw(await paymaster.getBalance());
        const routes = [
            {
                router: uniswapRouterAddress,
                tokenIn: wethAddress,
                tokenOut: usdcAddress,
                amountIn: ethers.parseEther("1"),
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
                minAmountOut: ethers.parseEther("1"),
                path: ethers.solidityPacked([
                    "address", "uint24", "address"
                ], [usdcAddress, 3000, wethAddress]),
                fee: 3000
            }
        ];
        const userOp = {
            sender: await account.getAddress(),
            nonce: await account.getNonce(),
            initCode: "0x",
            callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                wethAddress,
                ethers.parseEther("1"),
                routes,
                config.testParams.minProfit.toString()
            ]),
            callGasLimit: 1000000,
            verificationGasLimit: 1000000,
            preVerificationGas: 1000000,
            maxFeePerGas: ethers.parseUnits("100", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: ethers.solidityPacked(
                ["address", "bytes"],
                [await paymaster.getAddress(), "0x"]
            ),
            signature: "0x"
        };
        const userOpHash = await entryPoint.getUserOpHash(userOp);
        const userOpHashBytes = ethers.getBytes(userOpHash);
        const signature = await userWallet.signMessage(userOpHashBytes);
        userOp.signature = signature;
        await expect(entryPoint.handleOps(userOp, owner.address))
            .to.be.reverted;
    });

    it("should profile gas usage in arbitrage execution", async function () {
        const routes = [
            {
                router: uniswapRouterAddress,
                tokenIn: wethAddress,
                tokenOut: usdcAddress,
                amountIn: ethers.parseEther("1"),
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
                minAmountOut: ethers.parseEther("1"),
                path: ethers.solidityPacked([
                    "address", "uint24", "address"
                ], [usdcAddress, 3000, wethAddress]),
                fee: 3000
            }
        ];
        const userOp = {
            sender: await account.getAddress(),
            nonce: await account.getNonce(),
            initCode: "0x",
            callData: arbitrage.interface.encodeFunctionData("executeArbitrage", [
                wethAddress,
                ethers.parseEther("1"),
                routes,
                config.testParams.minProfit.toString()
            ]),
            callGasLimit: 1000000,
            verificationGasLimit: 1000000,
            preVerificationGas: 1000000,
            maxFeePerGas: ethers.parseUnits("100", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: ethers.solidityPacked(
                ["address", "bytes"],
                [await paymaster.getAddress(), "0x"]
            ),
            signature: "0x"
        };
        const userOpHash = await entryPoint.getUserOpHash(userOp);
        const userOpHashBytes = ethers.getBytes(userOpHash);
        const signature = await userWallet.signMessage(userOpHashBytes);
        userOp.signature = signature;
        await expect(entryPoint.handleOps(userOp, owner.address))
            .to.be.reverted;
    });
}); 