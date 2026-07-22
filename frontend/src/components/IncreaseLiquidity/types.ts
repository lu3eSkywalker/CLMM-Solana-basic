import { BN } from "@coral-xyz/anchor";

export interface IncreaseLiquidityState {
  step: "select-pool" | "select-position";
  selectedPool: PoolData | null;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0Max: string;
  amount1Max: string;
}

export interface PoolData {
  address: string;
  tokenMint0: string;
  tokenMint1: string;
  currentTick: number;
  liquidity: BN;
  price: number;
  tickSpacing: number;
  sqrtPriceX64: BN;
  tokenVault0: string;
  tokenVault1: string;
}

export interface TickArrayData {
  address: string;
  poolId: string;
  startTickIndex: number;
  initializedTickCount: number;
}

export const DEFAULT_U64_MAX = "18446744073709551615";
