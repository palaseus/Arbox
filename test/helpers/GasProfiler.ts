import { Contract, ContractReceipt } from "ethers";

interface GasCheckpoint {
  label: string;
  gasLeft: bigint;
}

interface GasProfile {
  totalGas: bigint;
  checkpoints: GasCheckpoint[];
  swaps: {
    router: string;
    inputAmount: string;
    outputAmount: string;
  }[];
}

export class GasProfiler {
  private contract: Contract;

  constructor(contract: Contract) {
    this.contract = contract;
  }

  async profileTransaction(receipt: ContractReceipt): Promise<GasProfile> {
    const gasCheckpoints: GasCheckpoint[] = [];
    const swaps: { router: string; inputAmount: string; outputAmount: string }[] = [];

    // Parse GasCheckpoint events
    const checkpointEvents = receipt.logs.filter(
      (log) => log.fragment?.name === "GasCheckpoint"
    );
    if (checkpointEvents) {
      for (const event of checkpointEvents) {
        const args = event.args as any;
        gasCheckpoints.push({
          label: args.label,
          gasLeft: args.gasLeft,
        });
      }
    }

    // Parse SwapExecuted events
    const swapEvents = receipt.logs.filter(
      (log) => log.fragment?.name === "SwapExecuted"
    );
    if (swapEvents) {
      for (const event of swapEvents) {
        const args = event.args as any;
        swaps.push({
          router: args.router,
          inputAmount: args.inputAmount.toString(),
          outputAmount: args.outputAmount.toString(),
        });
      }
    }

    return {
      totalGas: receipt.gasUsed,
      checkpoints: gasCheckpoints,
      swaps: swaps,
    };
  }

  formatGasProfile(profile: GasProfile): string {
    let output = "\nGas Profile:\n";
    output += `Total Gas Used: ${profile.totalGas}\n\n`;

    output += "Checkpoints:\n";
    for (let i = 0; i < profile.checkpoints.length; i++) {
      const checkpoint = profile.checkpoints[i];
      if (i > 0) {
        const gasUsed = profile.checkpoints[i - 1].gasLeft - checkpoint.gasLeft;
        output += `  ${checkpoint.label}: ${gasUsed} gas\n`;
      }
    }

    output += "\nSwaps:\n";
    for (const swap of profile.swaps) {
      output += `  Router: ${swap.router}\n`;
      output += `  Input: ${swap.inputAmount}\n`;
      output += `  Output: ${swap.outputAmount}\n`;
    }

    return output;
  }
} 