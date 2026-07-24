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
  vaultAmount0: string;
  vaultAmount1: string;
}

export interface TickData {
  tickIndex: number;
  liquidityNet: string;
  liquidityGross: string;
  price: number;
}

export interface TickArrayData {
  address: string;
  startTickIndex: number;
  initializedTickCount: number;
  ticks: TickData[];
}

export interface SwapResult {
  amountIn: string;
  amountOut: string;
  executionPrice: number | string;
  priceImpact: number;
  ticksCrossed: number;
  tickCrossDetails: Array<{
    tick: number;
    liquidityBefore: string;
    liquidityAfter: string;
  }>;
  finalSqrtPrice: number;
  finalPrice: number;
  finalTick: number;
  poolFeeNote: string;
  capped: boolean;
  maxAvailable: string;
}

export interface SwapTxState {
  isSubmitting: boolean;
  error: string | null;
  txSignature: string | null;
}
