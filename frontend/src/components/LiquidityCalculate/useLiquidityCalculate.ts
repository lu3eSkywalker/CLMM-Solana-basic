"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getMint } from "@solana/spl-token";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";
import { PoolData, TickData, TickArrayInfo, CalculationResult } from "./types";
import { tickToPrice } from "@/components/OpenPosition/types";

function sqrtPriceAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

function createReadOnlyWallet() {
  return {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: unknown) => tx,
    signAllTransactions: async (txs: unknown) => txs,
  };
}

export function useLiquidityCalculate() {
  const { connection } = useConnection();

  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [tickArrays, setTickArrays] = useState<TickArrayInfo[]>([]);
  const [allTicks, setAllTicks] = useState<TickData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTicks, setLoadingTicks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  // Fetches and parses on-chain pool state for a given pool address.
  const fetchPool = useCallback(
    async (poolAddress: string) => {
      setLoading(true);
      setError(null);
      setPoolData(null);
      setTickArrays([]);
      setAllTicks([]);
      setFetched(false);

      try {
        const readOnlyWallet = createReadOnlyWallet();

        const provider = new AnchorProvider(connection, readOnlyWallet as unknown as AnchorProvider["wallet"], {
          commitment: "confirmed",
        });

        const program = new Program<ClmmBasic>(IDL as ClmmBasic, provider);

        const poolPk = new (await import("@solana/web3.js")).PublicKey(poolAddress.trim());
        const poolAccountInfo = await connection.getAccountInfo(poolPk);
        if (!poolAccountInfo) {
          throw new Error("Pool account not found. Make sure the address is correct.");
        }

        const accounts = await program.account.poolState.all();
        const poolAcc = accounts.find(
          (acc) => acc.publicKey.toBase58() === poolAddress.trim()
        );
        if (!poolAcc) {
          throw new Error("Pool account not found on-chain.");
        }

        const s = poolAcc.account;
        const sqrtF = Number(s.sqrtPriceX64.toString()) / 2 ** 64;
        const price = sqrtF * sqrtF;

        const mint0Info = await getMint(connection, s.tokenMint0);
        const mint1Info = await getMint(connection, s.tokenMint1);

        const data: PoolData = {
          address: poolAcc.publicKey.toBase58(),
          sqrtPriceX64: s.sqrtPriceX64,
          liquidity: s.liquidity,
          tokenMint0: s.tokenMint0.toBase58(),
          tokenMint1: s.tokenMint1.toBase58(),
          tokenVault0: s.tokenVault0.toBase58(),
          tokenVault1: s.tokenVault1.toBase58(),
          tickSpacing: s.tickSpacing,
          currentTick: s.currentTick,
          price,
          tokenDecimals0: mint0Info.decimals,
          tokenDecimals1: mint1Info.decimals,
        };

        setPoolData(data);
        setFetched(true);
      } catch (err: unknown) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to fetch pool");
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  // Fetches all initialized tick arrays for a pool from the CLMM program,
  // filters ticks with liquidityGross > 0, sorts by tick index,
  // and stores both grouped (tickArrays) and flattened (allTicks) results.
  const fetchTicks = useCallback(
    async (poolAddress: string) => {
      setLoadingTicks(true);
      setError(null);

      try {
        const readOnlyWallet = createReadOnlyWallet();

        const provider = new AnchorProvider(connection, readOnlyWallet as unknown as AnchorProvider["wallet"], {
          commitment: "confirmed",
        });

        const program = new Program<ClmmBasic>(IDL as ClmmBasic, provider);
        const accounts = await program.account.tickArrayState.all();

        const filtered = accounts
          .filter((acc) => acc.account.poolId.toBase58() === poolAddress.trim())
          .map((acc) => {
            const ticks: TickData[] = [];
            const rawTicks = acc.account.ticks as Array<{ tick: number | string; liquidityGross?: { toString: () => string }; liquidityNet?: { toString: () => string } }>;
            for (const t of rawTicks) {
              const tickIdx = typeof t.tick === "number" ? t.tick : Number(t.tick);
              const gross = t.liquidityGross?.toString() ?? "0";
              if (BigInt(gross) > BigInt(0)) {
                ticks.push({
                  tickIndex: tickIdx,
                  liquidityNet: t.liquidityNet?.toString() ?? "0",
                  liquidityGross: gross,
                  price: tickToPrice(tickIdx),
                });
              }
            }

            return {
              address: acc.publicKey.toBase58(),
              startTickIndex: acc.account.startTickIndex,
              initializedTickCount: acc.account.initializedTickCount,
              ticks,
            };
          })
          .sort((a, b) => a.startTickIndex - b.startTickIndex);

        setTickArrays(filtered);

        const combined: TickData[] = [];
        for (const ta of filtered) {
          combined.push(...ta.ticks);
        }
        combined.sort((a, b) => a.tickIndex - b.tickIndex);
        setAllTicks(combined);

        if (combined.length === 0) {
          setError("No initialized ticks found for this pool.");
        }
      } catch (err: unknown) {
        console.error("Failed to fetch tick arrays:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch tick arrays");
      } finally {
        setLoadingTicks(false);
      }
    },
    [connection]
  );

  // calculates token amounts and liquidity for a CLMM position given a tick range and input amount
  const calculate = useCallback(
    (
      tickLower: number,
      tickUpper: number,
      inputAmount: string,
      inputToken: 0 | 1
    ): CalculationResult | null => {
      if (!poolData) return null;
      if (tickLower >= tickUpper) return null;
      if (!inputAmount || parseFloat(inputAmount) <= 0) return null;

      const currentTick = poolData.currentTick;
      const sqrtPrice = sqrtPriceAtTick(currentTick);
      const sqrtPriceLower = sqrtPriceAtTick(tickLower);
      const sqrtPriceUpper = sqrtPriceAtTick(tickUpper);

      const currentPrice = tickToPrice(currentTick);
      const priceLower = tickToPrice(tickLower);
      const priceUpper = tickToPrice(tickUpper);

      const amountIn = parseFloat(inputAmount);

      let amount0: number;
      let amount1: number;
      let liquidity: number;
      let inRange = false;

      if (currentTick >= tickLower && currentTick < tickUpper) {
        inRange = true;
        if (inputToken === 0) {
          const diffUpper = sqrtPriceUpper - sqrtPrice;
          if (diffUpper <= 0) return null;
          liquidity = (amountIn * sqrtPrice * sqrtPriceUpper) / diffUpper;
          const diffLower = sqrtPrice - sqrtPriceLower;
          amount1 = liquidity * diffLower;
          amount0 = amountIn;
        } else {
          const diffLower = sqrtPrice - sqrtPriceLower;
          if (diffLower <= 0) return null;
          liquidity = amountIn / diffLower;
          const diffUpper = sqrtPriceUpper - sqrtPrice;
          amount0 = (liquidity * diffUpper) / (sqrtPrice * sqrtPriceUpper);
          amount1 = amountIn;
        }
      } else if (currentTick < tickLower) {
        amount0 = amountIn;
        amount1 = 0;
        const diff = sqrtPriceUpper - sqrtPriceLower;
        if (diff <= 0) return null;
        liquidity = (amountIn * sqrtPriceLower * sqrtPriceUpper) / diff;
      } else {
        amount0 = 0;
        amount1 = amountIn;
        const diff = sqrtPriceUpper - sqrtPriceLower;
        if (diff <= 0) return null;
        liquidity = amountIn / diff;
      }

      return {
        amount0: amount0 < 0.000001 && amount0 > 0 ? amount0.toExponential(4) : amount0.toFixed(6),
        amount1: amount1 < 0.000001 && amount1 > 0 ? amount1.toExponential(4) : amount1.toFixed(6),
        liquidity: liquidity < 1 ? liquidity.toExponential(4) : liquidity.toFixed(4),
        sqrtPrice,
        sqrtPriceLower,
        sqrtPriceUpper,
        currentPrice,
        priceLower,
        priceUpper,
        inRange,
      };
    },
    [poolData]
  );

  return {
    poolData,
    tickArrays,
    allTicks,
    loading,
    loadingTicks,
    error,
    fetched,
    fetchPool,
    fetchTicks,
    calculate,
  };
}
