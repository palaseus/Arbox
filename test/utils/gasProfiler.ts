import { Contract, ContractTransaction } from "ethers";
import * as fs from "fs";
import * as path from "path";

export interface GasProfile {
  contractName: string;
  functionName: string;
  times: number;
  gasUsages: number[];
  avgGasUsed: number;
  variance: number;
  maxGasUsed: number;
  minGasUsed: number;
  timestamp: string;
  network: string;
  blockNumber: number;
  commitHash?: string;
}

export interface GasProfileComparison {
  baseline: GasProfile;
  current: GasProfile;
  diff: {
    avgGasUsed: number;
    maxGasUsed: number;
    minGasUsed: number;
    percentageChange: number;
  };
}

export class GasProfiler {
  private static readonly RESULTS_DIR = path.join(__dirname, '../results');

  static async profile(
    contract: Contract,
    functionName: string,
    args: any[] = [],
    times: number = 5
  ): Promise<GasProfile> {
    const gasUsages: number[] = [];
    const provider = contract.provider;
    const network = await provider?.getNetwork();
    const blockNumber = await provider?.getBlockNumber();

    for (let i = 0; i < times; i++) {
      const tx = await contract[functionName](...args);
      const receipt = await tx.wait();
      gasUsages.push(Number(receipt.gasUsed));
    }

    const avgGasUsed = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
    const variance = gasUsages.reduce((a, b) => a + Math.pow(b - avgGasUsed, 2), 0) / gasUsages.length;
    const maxGasUsed = Math.max(...gasUsages);
    const minGasUsed = Math.min(...gasUsages);

    return {
      contractName: contract.constructor.name,
      functionName,
      times,
      gasUsages,
      avgGasUsed,
      variance,
      maxGasUsed,
      minGasUsed,
      timestamp: new Date().toISOString(),
      network: network?.name || 'unknown',
      blockNumber: blockNumber || 0
    };
  }

  static saveProfile(profile: GasProfile): string {
    if (!fs.existsSync(this.RESULTS_DIR)) {
      fs.mkdirSync(this.RESULTS_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(
      this.RESULTS_DIR,
      `${profile.contractName}_${profile.functionName}_${timestamp}_gas_profile.json`
    );

    fs.writeFileSync(outputPath, JSON.stringify(profile, null, 2));
    return outputPath;
  }

  static loadProfile(filePath: string): GasProfile {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  static compareProfiles(baseline: GasProfile, current: GasProfile): GasProfileComparison {
    const percentageChange = ((current.avgGasUsed - baseline.avgGasUsed) / baseline.avgGasUsed) * 100;

    return {
      baseline,
      current,
      diff: {
        avgGasUsed: current.avgGasUsed - baseline.avgGasUsed,
        maxGasUsed: current.maxGasUsed - baseline.maxGasUsed,
        minGasUsed: current.minGasUsed - baseline.minGasUsed,
        percentageChange
      }
    };
  }

  static async getLatestProfile(contractName: string, functionName: string): Promise<GasProfile | null> {
    if (!fs.existsSync(this.RESULTS_DIR)) {
      return null;
    }

    const files = fs.readdirSync(this.RESULTS_DIR)
      .filter(file => file.startsWith(`${contractName}_${functionName}`))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    return this.loadProfile(path.join(this.RESULTS_DIR, files[0]));
  }
} 