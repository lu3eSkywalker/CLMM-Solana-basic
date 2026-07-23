import { BN } from "@coral-xyz/anchor";

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

export interface TickData {
  tickIndex: number;
  liquidityNet: string;
  liquidityGross: string;
  price: number;
}

export interface TickRange {
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  liquidityGross: string;
  estToken0: string;
  estToken1: string;
}

export const DEFAULT_U64_MAX = "18446744073709551615";
