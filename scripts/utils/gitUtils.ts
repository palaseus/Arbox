import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class GitUtils {
  private static readonly CACHE_DIR = path.join(__dirname, '../../.cache/gas-profiles');

  static getCurrentBranch(): string {
    return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  }

  static getCurrentCommit(): string {
    return execSync('git rev-parse HEAD').toString().trim();
  }

  static async checkoutMain(): Promise<void> {
    try {
      execSync('git fetch origin main:main', { stdio: 'inherit' });
      execSync('git checkout main', { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to checkout main branch: ${error}`);
    }
  }

  static async checkoutOriginalBranch(branch: string): Promise<void> {
    try {
      execSync(`git checkout ${branch}`, { stdio: 'inherit' });
    } catch (error) {
      throw new Error(`Failed to checkout original branch: ${error}`);
    }
  }

  static getMainCommit(): string {
    try {
      return execSync('git rev-parse origin/main').toString().trim();
    } catch (error) {
      throw new Error(`Failed to get main commit: ${error}`);
    }
  }

  static async getMainBaseline(contractName: string, functionName: string): Promise<any> {
    const mainCommit = this.getMainCommit();
    const cacheKey = `${contractName}_${functionName}_${mainCommit}`;
    const cachePath = path.join(this.CACHE_DIR, `${cacheKey}.json`);

    // Create cache directory if it doesn't exist
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }

    // Check if we have a cached baseline
    if (fs.existsSync(cachePath)) {
      const cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      if (cachedData.commit === mainCommit) {
        return cachedData.profile;
      }
    }

    // If no cache or cache is stale, we need to run the profiler on main
    const originalBranch = this.getCurrentBranch();
    try {
      await this.checkoutMain();
      
      // Run the gas profiler on main
      const profile = await this.runGasProfiler(contractName, functionName);
      
      // Cache the result
      fs.writeFileSync(cachePath, JSON.stringify({
        commit: mainCommit,
        profile,
        timestamp: new Date().toISOString()
      }));

      return profile;
    } finally {
      await this.checkoutOriginalBranch(originalBranch);
    }
  }

  private static async runGasProfiler(contractName: string, functionName: string): Promise<any> {
    // This is a placeholder - we'll need to implement the actual gas profiling logic
    // that can be run programmatically rather than through the CLI
    const { GasProfiler } = require('../utils/gasProfiler');
    const { ethers } = require('hardhat');
    
    const [deployer] = await ethers.getSigners();
    const ContractFactory = await ethers.getContractFactory(contractName, deployer);
    const contract = await ContractFactory.deploy();
    await contract.waitForDeployment();

    return await GasProfiler.profile(contract, functionName, [], 5);
  }
} 