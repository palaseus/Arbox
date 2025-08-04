# Arbox - Advanced DeFi Arbitrage Bot

A sophisticated DeFi arbitrage bot that leverages ERC-4337 Account Abstraction for enhanced security and user experience. The bot executes flash loan arbitrage across multiple DEXes while maintaining strict security measures and gas optimization.

## 🚀 Features

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

## 📋 Prerequisites

- Node.js v20+
- npm or yarn
- Hardhat

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Arbox
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Compile contracts**
   ```bash
   npm run compile
   ```

## 🧪 Testing

The project includes a comprehensive test suite with 16 passing tests covering all major functionality:

### Run All Tests
```bash
npm test
```

### Run Specific Test Categories
```bash
# Gas profiling tests
npm run test:gas

# Gas profiling runner
npm run gas-profile
```

### Test Coverage
- ✅ **Arbitrage Simulation** - Automated simulation loop with mock contracts
- ✅ **ERC-4337 Arbitrage** - Account abstraction functionality with signature validation
- ✅ **FlashLoanArbitrage** - Core arbitrage contract functionality
- ✅ **Gas Profiling** - Gas usage analysis and optimization
- ✅ **Paymaster Gas Profiling** - Gas profiling for paymaster operations
- ✅ **Modular Arbitrage Strategy** - Strategy pattern implementation

### Environment Setup (Optional)
For tests that require mainnet forking (Real Arbitrage Simulation), create a `.env` file:
```bash
# Mainnet RPC URL for forking (replace with your actual RPC URL)
MAINNET_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your-api-key-here

# Optional: Etherscan API key for contract verification
ETHERSCAN_API_KEY=your-etherscan-api-key-here
```

## 🏗️ Smart Contracts

### Core Contracts
- `FlashLoanArbitrage.sol` - Main arbitrage execution contract
- `Account.sol` - ERC-4337 account abstraction implementation
- `Paymaster.sol` - Gas payment abstraction
- `EntryPoint.sol` - ERC-4337 entry point implementation

### Supporting Contracts
- `ModularArbitrageStrategy.sol` - Strategy pattern implementation
- `ApprovalHelper.sol` - Token approval management
- `AlwaysSuccessRouter.sol` - Testing router implementation

### Router Implementations
- `UniswapV3Router.sol` - Uniswap V3 integration
- `SushiRouter.sol` - Sushiswap integration
- `BalancerRouter.sol` - Balancer integration

### Mock Contracts (Testing)
- `MockERC20.sol` - Mock ERC20 tokens for testing
- `MockAavePool.sol` - Mock Aave lending pool
- `MockPoolAddressesProvider.sol` - Mock Aave addresses provider
- `MockUniswapV3Router.sol` - Mock Uniswap V3 router
- `MockSushiswapRouter.sol` - Mock Sushiswap router

## ⚙️ Configuration

The bot can be configured through the following parameters:

- `minProfit`: Minimum absolute profit required
- `minProfitPercentage`: Minimum profit as percentage of flash loan amount
- `maxSlippage`: Maximum allowed slippage in basis points
- `maxGasPrice`: Maximum gas price in wei

### Example Configuration
```typescript
const config = {
  minProfit: ethers.parseEther("0.001"),
  minProfitPercentage: 50, // 0.5%
  maxSlippage: 100, // 1%
  maxGasPrice: ethers.parseUnits("100", "gwei")
};
```

## 🔧 Development

### Project Structure
```
Arbox/
├── contracts/           # Smart contracts
│   ├── interfaces/     # Contract interfaces
│   ├── mocks/         # Mock contracts for testing
│   ├── routers/       # DEX router implementations
│   └── utils/         # Utility contracts
├── test/              # Test files
│   ├── config/        # Test configuration
│   ├── helpers/       # Test helper functions
│   └── results/       # Gas profiling results
├── scripts/           # Deployment and utility scripts
└── ignition/          # Hardhat Ignition deployment modules
```

### Available Scripts
```bash
npm run compile        # Compile contracts
npm run test           # Run all tests
npm run test:gas       # Run gas profiling tests
npm run gas-profile    # Run gas profiling analysis
npm run clean          # Clean build artifacts
```

## 🔒 Security Considerations

1. **Flash Loan Risks**: The bot uses Aave V3 flash loans, which must be repaid within the same transaction
2. **Slippage Protection**: Maximum slippage is enforced to prevent sandwich attacks
3. **Gas Optimization**: Gas usage is monitored and optimized
4. **Entry Point Validation**: Strict validation of transaction sources
5. **Profit Thresholds**: Multiple profit thresholds to ensure profitable trades

## 📊 Gas Optimization

The project includes comprehensive gas profiling:

- **Gas Usage Analysis**: Tracks gas consumption at each step
- **Optimization Reports**: Detailed reports saved to `test/results/`
- **Consistency Testing**: Ensures gas usage remains consistent across executions
- **Maximum Route Testing**: Tests efficiency with maximum route lengths

### Gas Profiling Results
- Paymaster validation: ~29,044 gas
- Strategy execution: ~44,433 gas
- Arbitrage execution: ~89,992 gas (average)

## 🚨 Disclaimer

This software is for educational purposes only. Use at your own risk. The authors are not responsible for any financial losses incurred through the use of this software.

## 📄 License

This project is licensed under the GNU PGLv3.0 - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Ensure all tests pass before submitting PRs
- Add tests for new functionality
- Follow the existing code style
- Update documentation for new features

## 📈 Current Status

- ✅ **Core functionality implemented**
- ✅ **Comprehensive test suite (16/16 passing)**
- ✅ **Gas optimization and profiling**
- ✅ **ERC-4337 account abstraction**
- ✅ **Multi-DEX router support**
- ✅ **Security measures implemented**

## 🔮 Roadmap

- [ ] Real mainnet integration testing
- [ ] Additional DEX integrations
- [ ] Advanced MEV protection
- [ ] Web interface for monitoring
- [ ] Automated deployment scripts
- [ ] Performance benchmarking tools
