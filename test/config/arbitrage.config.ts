import { ethers } from "hardhat";

export interface TokenConfig {
  address: string;
  decimals: number;
  whale: string;
  symbol: string;
}

export interface RouterConfig {
  address: string;
  name: string;
  type: "uniswap_v3" | "sushiswap" | "balancer" | "curve";
  fee?: number; // For Uniswap V3 pools
}

export interface ArbitrageConfig {
  tokens: {
    [key: string]: TokenConfig;
  };
  routers: {
    [key: string]: RouterConfig;
  };
  testParams: {
    defaultAmount: bigint;
    minProfit: bigint;
    gasLimit: bigint;
    blockNumber: number;
    smallTradeAmount: bigint;
    highSlippageAmount: bigint;
    highSlippagePercentage: number;
  };
  pairs: {
    name: string;
    tokenIn: string;
    tokenOut: string;
    fee?: number;
  }[];
}

export const config: ArbitrageConfig & { aave: { POOL_ADDRESSES_PROVIDER: string } } = {
  aave: {
    POOL_ADDRESSES_PROVIDER: "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e" // Mainnet Aave v3 PoolAddressesProvider
  },
  tokens: {
    WETH: {
      address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      decimals: 18,
      whale: "0x28C6c06298d514Db089934071355E5743bf21d60",
      symbol: "WETH"
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      decimals: 6,
      whale: "0x55fe002aeff02f77364de339a1292923a15844b8",
      symbol: "USDC"
    },
    DAI: {
      address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      decimals: 18,
      whale: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
      symbol: "DAI"
    },
    USDT: {
      address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      decimals: 6,
      whale: "0x5754284f345afc66a98fbB0a0Afe71e0F007B949",
      symbol: "USDT"
    }
  },
  routers: {
    UNISWAP_V3: {
      address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      name: "Uniswap V3",
      type: "uniswap_v3"
    },
    SUSHISWAP: {
      address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
      name: "SushiSwap",
      type: "sushiswap"
    },
    BALANCER: {
      address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
      name: "Balancer",
      type: "balancer"
    }
  },
  testParams: {
    defaultAmount: ethers.parseEther("0.1"),
    minProfit: ethers.parseEther("0.001"),
    gasLimit: ethers.parseUnits("500000", 0),
    blockNumber: 19300000,
    smallTradeAmount: ethers.parseUnits("100", 6),
    highSlippageAmount: ethers.parseUnits("1000", 6),
    highSlippagePercentage: 300
  },
  pairs: [
    {
      name: "WETH-USDC",
      tokenIn: "WETH",
      tokenOut: "USDC",
      fee: 3000
    },
    {
      name: "WETH-DAI",
      tokenIn: "WETH",
      tokenOut: "DAI",
      fee: 3000
    },
    {
      name: "USDC-DAI",
      tokenIn: "USDC",
      tokenOut: "DAI",
      fee: 500
    },
    {
      name: "WETH-USDT",
      tokenIn: "WETH",
      tokenOut: "USDT",
      fee: 3000
    }
  ]
}; 