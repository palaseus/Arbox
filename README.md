# Arbox - Advanced DeFi Arbitrage Bot

A sophisticated DeFi arbitrage bot that leverages ERC-4337 Account Abstraction for enhanced security and user experience. The bot executes flash loan arbitrage across multiple DEXes while maintaining strict security measures and gas optimization.

## Features

### Core Functionality
- **Flash Loan Arbitrage**: Execute arbitrage opportunities using Aave V3 flash loans
- **Multi-DEX Support**: Trade across multiple DEXes including Uniswap V2/V3 and Sushiswap
- **ERC-4337 Integration**: Enhanced security through account abstraction
- **Gas Optimization**: Built-in gas profiling and optimization
- **Risk Management**: Configurable parameters for slippage, profit thresholds, and gas limits

### Security Features
- **Entry Point Validation**: Strict validation of transaction sources
- **Gas Price Controls**: Maximum gas price limits to prevent MEV attacks
- **Slippage Protection**: Configurable maximum slippage tolerance
- **Profit Thresholds**: Minimum profit requirements in both absolute and percentage terms

### Technical Features
- **Modular Architecture**: Easy to extend with new DEX integrations
- **Gas Profiling**: Detailed gas usage tracking and optimization
- **Comprehensive Testing**: Extensive test suite covering all major functionality
- **TypeScript Support**: Full TypeScript implementation for better development experience

## Smart Contracts

### Core Contracts
- `FlashLoanArbitrage.sol`: Main arbitrage execution contract
- `Account.sol`: ERC-4337 account abstraction implementation
- `Paymaster.sol`: Gas payment abstraction
- `EntryPoint.sol`: ERC-4337 entry point implementation

### Supporting Contracts
- `ModularArbitrageStrategy.sol`: Strategy pattern implementation
- `ApprovalHelper.sol`: Token approval management
- `AlwaysSuccessRouter.sol`: Testing router implementation

## Development

### Prerequisites
- Node.js v20+
- npm or yarn
- Hardhat

### Installation
```bash
npm install
```

### Testing
```bash
# Run all tests
npm test

# Run gas profiling tests
npm run test:gas
```

### Compilation
```bash
npm run compile
```

## Configuration

The bot can be configured through the following parameters:

- `minProfit`: Minimum absolute profit required
- `minProfitPercentage`: Minimum profit as percentage of flash loan amount
- `maxSlippage`: Maximum allowed slippage in basis points
- `maxGasPrice`: Maximum gas price in wei

## Security Considerations

1. **Flash Loan Risks**: The bot uses Aave V3 flash loans, which must be repaid within the same transaction
2. **Slippage Protection**: Maximum slippage is enforced to prevent sandwich attacks
3. **Gas Optimization**: Gas usage is monitored and optimized
4. **Entry Point Validation**: Strict validation of transaction sources
5. **Profit Thresholds**: Multiple profit thresholds to ensure profitable trades

## License

This project is licensed under the GNU PGLv3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Disclaimer

This software is for educational purposes only. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.
