import { Contract } from "ethers";
import { ContractReceipt, Event } from "@ethersproject/contracts";

interface GasCheckpoint {
  label: string;
  gasLeft: number;
}

interface GasProfile {
  totalGas: number;
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
    const checkpointEvents = receipt.events?.filter(
      (event: Event) => event.event === "GasCheckpoint"
    );
    if (checkpointEvents) {
      for (const event of checkpointEvents) {
        gasCheckpoints.push({
          label: event.args?.label,
          gasLeft: event.args?.gasLeft.toNumber(),
        });
      }
    }

    // Parse SwapExecuted events
    const swapEvents = receipt.events?.filter(
      (event: Event) => event.event === "SwapExecuted"
    );
    if (swapEvents) {
      for (const event of swapEvents) {
        swaps.push({
          router: event.args?.router,
          inputAmount: event.args?.inputAmount.toString(),
          outputAmount: event.args?.outputAmount.toString(),
        });
      }
    }

    return {
      totalGas: receipt.gasUsed.toNumber(),
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