# DeFi Arbitrage Bot with ERC-4337 Account Abstraction

[![Test and Gas Profile](https://github.com/palaseus/Arbox/actions/workflows/test.yml/badge.svg)](https://github.com/palaseus/Arbox/actions/workflows/test.yml)

A sophisticated DeFi arbitrage bot that leverages ERC-4337 Account Abstraction for enhanced security and user experience.

## Features

- Real-time arbitrage opportunity detection
- ERC-4337 Account Abstraction integration
- Gas-optimized execution
- Comprehensive test suite
- Gas profiling and regression testing

## Gas Profiling

The project includes a robust gas profiling system that helps track and optimize gas usage. The system generates detailed reports and can be integrated into your CI/CD pipeline to prevent gas usage regressions.

### Usage

```bash
# Basic gas profiling
npx hardhat run scripts/gasProfileRunner.ts --contract RealArbitrage --function executeArbitrage --times 5

# Compare with baseline and fail if gas usage increases by more than 5%
npx hardhat run scripts/gasProfileRunner.ts \
  --contract RealArbitrage \
  --function executeArbitrage \
  --times 5 \
  --compare \
  --fail-on-diff \
  --max-increase 5

# Use a specific baseline file
npx hardhat run scripts/gasProfileRunner.ts \
  --contract RealArbitrage \
  --function executeArbitrage \
  --baseline test/results/baseline.json

# Compare with main branch baseline
npx hardhat run scripts/gasProfileRunner.ts \
  --contract RealArbitrage \
  --function executeArbitrage \
  --compare-main

# Generate summary-only output
npx hardhat run scripts/gasProfileRunner.ts \
  --contract RealArbitrage \
  --function executeArbitrage \
  --summary-only
```

### Command Line Options

- `--contract`: Contract name to profile (required)
- `--function`: Function name to profile (required)
- `--times`: Number of runs (default: 5)
- `--compare`: Compare with baseline
- `--max-increase`: Maximum allowed gas increase percentage (default: 5)
- `--baseline`: Path to baseline JSON file
- `--fail-on-diff`: Fail if gas usage increases
- `--compare-main`: Compare with main branch baseline
- `--summary-only`: Only show summary output

### Output Files

The gas profiler generates three types of files in the `test/results` directory:

1. `*_gas_profile.json`: Detailed gas usage data for each run
2. `*_summary.json`: Summary statistics including average, min, max, and variance
3. `*_comparison.json`: Comparison with baseline (if applicable)
4. `*_report.md`: Markdown report with formatted tables

Example output:
```
=== Gas Profiling ===
Contract: RealArbitrage
Function: executeArbitrage
Runs: 5

=== Summary ===
┌─────────────────┬─────────────────┐
│ Metric          │ Value           │
├─────────────────┼─────────────────┤
│ Average Gas     │ 123456         │
│ Max Gas         │ 124567         │
│ Min Gas         │ 122345         │
│ Variance        │ 1234.56        │
└─────────────────┴─────────────────┘

=== Comparison with Baseline ===
┌─────────────────┬─────────────────┐
│ Metric          │ Change          │
├─────────────────┼─────────────────┤
│ Average Gas     │ +100 (+0.81%)   │
│ Max Gas         │ +200 (+1.61%)   │
│ Min Gas         │ +50 (+0.41%)    │
└─────────────────┴─────────────────┘
```

### CI Integration

The gas profiling system is integrated with GitHub Actions:
- Runs on every push and pull request
- Fails if gas usage increases beyond threshold
- Uploads profiling results as artifacts
- Comments PR with gas comparison table

### Best Practices

1. **Baseline Management**
   - Store baseline files in version control
   - Update baselines after significant optimizations
   - Use meaningful commit messages when updating baselines

2. **CI/CD Integration**
   - Set appropriate gas increase thresholds
   - Review gas changes in PR comments
   - Archive profiling results for historical analysis

3. **Development Workflow**
   - Run gas profiling before committing changes
   - Compare with main branch baseline
   - Document significant gas optimizations

## Development

1. Install dependencies:
```bash
npm install
```

2. Run tests:
```bash
npm test
```

3. Run gas profiling:
```bash
npm run gas-profile
```

## Test Utilities

The project includes reusable test utilities in `test/utils/`:

- `gasProfiler.ts`: Gas profiling and comparison utilities
- `testHelpers.ts`: Common test patterns and helpers

Example usage in tests:

```typescript
import { profileGas, compareWithBaseline } from "../utils/testHelpers";

describe("RealArbitrage", () => {
  it("should execute arbitrage with acceptable gas usage", async () => {
    await compareWithBaseline(
      realArbitrage,
      "executeArbitrage",
      [],
      5,
      5 // max allowed gas increase percentage
    );
  });
});
```

## License

MIT
