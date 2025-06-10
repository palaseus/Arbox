import { expect } from "chai";
import { Contract, ContractTransaction } from "ethers";
import { GasProfiler, GasProfile } from "./gasProfiler";

export async function expectRevert(
  tx: Promise<ContractTransaction>,
  expectedError?: string
): Promise<void> {
  try {
    await tx;
    expect.fail("Expected transaction to revert");
  } catch (error: any) {
    if (expectedError) {
      expect(error.message).to.include(expectedError);
    }
  }
}

export async function profileGas(
  contract: Contract,
  functionName: string,
  args: any[] = [],
  times: number = 5,
  saveProfile: boolean = true
): Promise<GasProfile> {
  const profile = await GasProfiler.profile(contract, functionName, args, times);
  
  if (saveProfile) {
    const outputPath = GasProfiler.saveProfile(profile);
    console.log(`Gas profile saved to: ${outputPath}`);
  }

  return profile;
}

export async function compareWithBaseline(
  contract: Contract,
  functionName: string,
  args: any[] = [],
  times: number = 5,
  maxAllowedIncrease: number = 10 // percentage
): Promise<void> {
  const baseline = await GasProfiler.getLatestProfile(contract.constructor.name, functionName);
  const current = await profileGas(contract, functionName, args, times, true);

  if (baseline) {
    const comparison = GasProfiler.compareProfiles(baseline, current);
    
    console.log("\nGas Usage Comparison:");
    console.log(`Average: ${comparison.diff.avgGasUsed} (${comparison.diff.percentageChange.toFixed(2)}%)`);
    console.log(`Max: ${comparison.diff.maxGasUsed}`);
    console.log(`Min: ${comparison.diff.minGasUsed}`);

    if (comparison.diff.percentageChange > maxAllowedIncrease) {
      throw new Error(
        `Gas usage increased by ${comparison.diff.percentageChange.toFixed(2)}%, ` +
        `which exceeds the maximum allowed increase of ${maxAllowedIncrease}%`
      );
    }
  }
}

export async function measureExecutionTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; executionTime: number }> {
  const start = Date.now();
  const result = await fn();
  const executionTime = Date.now() - start;
  return { result, executionTime };
} 