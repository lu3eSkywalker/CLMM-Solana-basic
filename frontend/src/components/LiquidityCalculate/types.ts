import { BN } from "@coral-xyz/anchor";

export interface PoolData {
  address: string;
  sqrtPriceX64: BN;
  liquidity: BN;
  tokenMint0: string;
  tokenMint1: string;
  tokenVault0: string;
  tokenVault1: string;
  tickSpacing: number;
  currentTick: number;
  price: number;
  tokenDecimals0: number;
  tokenDecimals1: number;
}

export interface TickData {
  tickIndex: number;
  liquidityNet: string;
  liquidityGross: string;
  price: number;
}

export interface TickArrayInfo {
  address: string;
  startTickIndex: number;
  initializedTickCount: number;
  ticks: TickData[];
}

export interface CalculationResult {
  amount0: string;
  amount1: string;
  liquidity: string;
  sqrtPrice: number;
  sqrtPriceLower: number;
  sqrtPriceUpper: number;
  currentPrice: number;
  priceLower: number;
  priceUpper: number;
  inRange: boolean;
}
