"use client";

import { useState, useCallback, useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";
import { PoolData, TickData, TickRange } from "./types";
import { useDecreaseLiquidity } from "./useDecreaseLiquidity";
import {
  tickArrayStartIndex,
  TICKS_PER_ARRAY,
  tickToPrice,
} from "@/components/OpenPosition/types";
import { findTickArrayPda } from "@/utils/pda";

function sqrtPriceAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

function estimateTokensForRange(
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  liquidityStr: string
): { estToken0: string; estToken1: string } {
  const liq = parseFloat(liquidityStr);
  if (isNaN(liq) || liq <= 0) return { estToken0: "0", estToken1: "0" };

  const sqrtPrice = sqrtPriceAtTick(currentTick);
  const sqrtPriceLower = sqrtPriceAtTick(tickLower);
  const sqrtPriceUpper = sqrtPriceAtTick(tickUpper);

  let amount0: number;
  let amount1: number;

  if (currentTick >= tickLower && currentTick < tickUpper) {
    const diffUpper = sqrtPriceUpper - sqrtPrice;
    const diffLower = sqrtPrice - sqrtPriceLower;
    amount0 = diffUpper > 0 ? (liq * diffUpper) / (sqrtPrice * sqrtPriceUpper) : 0;
    amount1 = diffLower > 0 ? liq * diffLower : 0;
  } else if (currentTick < tickLower) {
    const diff = sqrtPriceUpper - sqrtPriceLower;
    amount0 = diff > 0 ? (liq * (sqrtPriceUpper - sqrtPriceLower)) / (sqrtPriceLower * sqrtPriceUpper) : 0;
    amount1 = 0;
  } else {
    const diff = sqrtPriceUpper - sqrtPriceLower;
    amount0 = 0;
    amount1 = diff > 0 ? liq * diff : 0;
  }

  const fmt = (v: number) =>
    v < 0.000001 && v > 0 ? v.toExponential(4) : v.toFixed(6);

  return { estToken0: fmt(amount0), estToken1: fmt(amount1) };
}

export function DecreaseLiquidityPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [step, setStep] = useState<
    "select-pool" | "select-position" | "configure"
  >("select-pool");
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);
  const [tickRanges, setTickRanges] = useState<TickRange[]>([]);
  const [loadingTicks, setLoadingTicks] = useState(false);

  const [selectedRange, setSelectedRange] = useState<TickRange | null>(null);
  const [liquidity, setLiquidity] = useState("");
  const [amount0Min, setAmount0Min] = useState("0");
  const [amount1Min, setAmount1Min] = useState("0");

  const {
    submit,
    isSubmitting,
    error: txError,
    txSignature,
    validationError,
  } = useDecreaseLiquidity({
    pool: selectedPool!,
    tickLower: selectedRange?.tickLower ?? 0,
    tickUpper: selectedRange?.tickUpper ?? 1,
    liquidity,
    amount0Min,
    amount1Min,
  });

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatPrice = (price: number) =>
    price < 0.0001 ? price.toExponential(4) : price.toFixed(6);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const readOnlyWallet = {
        publicKey: Keypair.generate().publicKey,
        signTransaction: async (tx: unknown) => tx,
        signAllTransactions: async (txs: unknown) => txs,
      };

      const provider = new AnchorProvider(
        connection,
        readOnlyWallet as unknown as AnchorProvider["wallet"],
        { commitment: "confirmed" }
      );

      const program = new Program<ClmmBasic>(IDL as ClmmBasic, provider);
      const accounts = await program.account.poolState.all();

      const poolData: PoolData[] = accounts.map((acc) => {
        const s = acc.account;
        const sqrtF = Number(s.sqrtPriceX64.toString()) / 2 ** 64;
        const price = sqrtF * sqrtF;

        return {
          address: acc.publicKey.toBase58(),
          sqrtPriceX64: s.sqrtPriceX64,
          liquidity: s.liquidity,
          tokenMint0: s.tokenMint0.toBase58(),
          tokenMint1: s.tokenMint1.toBase58(),
          tokenVault0: s.tokenVault0.toBase58(),
          tokenVault1: s.tokenVault1.toBase58(),
          tickSpacing: s.tickSpacing,
          currentTick: s.currentTick,
          price,
        };
      });

      setPools(poolData);
      setFetched(true);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch pools");
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const fetchTickRanges = useCallback(async (pool: PoolData) => {
    setLoadingTicks(true);
    try {
      const readOnlyWallet = {
        publicKey: Keypair.generate().publicKey,
        signTransaction: async (tx: unknown) => tx,
        signAllTransactions: async (txs: unknown) => txs,
      };

      const provider = new AnchorProvider(
        connection,
        readOnlyWallet as unknown as AnchorProvider["wallet"],
        { commitment: "confirmed" }
      );

      const program = new Program<ClmmBasic>(IDL as ClmmBasic, provider);

      const tickSpacing = pool.tickSpacing;
      const currentTick = pool.currentTick;

      const lowerArrayStart = tickArrayStartIndex(currentTick - tickSpacing * 10);
      const upperArrayStart = tickArrayStartIndex(currentTick + tickSpacing * 10);

      const arrayStarts: number[] = [];
      for (
        let start = lowerArrayStart;
        start <= upperArrayStart;
        start += TICKS_PER_ARRAY
      ) {
        arrayStarts.push(start);
      }

      const allTicks: TickData[] = [];
      for (const startIndex of arrayStarts) {
        try {
          const [tickArrayPda] = findTickArrayPda(new PublicKey(pool.address), startIndex);
          const tickArray =
            await program.account.tickArrayState.fetchNullable(tickArrayPda);
          if (tickArray) {
            allTicks.push(
              ...tickArray.ticks.map((t) => ({
                tickIndex: t.tickIndex,
                liquidityNet: t.liquidityNet,
                liquidityGross: t.liquidityGross,
                price: tickToPrice(t.tickIndex),
              }))
            );
          }
        } catch {
          continue;
        }
      }

      const validTicks = allTicks
        .filter(
          (t) =>
            BigInt(t.liquidityGross) > 0 &&
            t.tickIndex % tickSpacing === 0
        )
        .sort((a, b) => a.tickIndex - b.tickIndex);

      const ranges: TickRange[] = [];
      for (let i = 0; i < validTicks.length - 1; i++) {
        const lower = validTicks[i];
        const upper = validTicks[i + 1];
        if (
          BigInt(lower.liquidityGross) > 0 &&
          BigInt(upper.liquidityGross) > 0
        ) {
          const est = estimateTokensForRange(
            lower.tickIndex,
            upper.tickIndex,
            currentTick,
            lower.liquidityGross.toString()
          );
          ranges.push({
            tickLower: lower.tickIndex,
            tickUpper: upper.tickIndex,
            priceLower: tickToPrice(lower.tickIndex),
            priceUpper: tickToPrice(upper.tickIndex),
            liquidityGross: lower.liquidityGross,
            estToken0: est.estToken0,
            estToken1: est.estToken1,
          });
        }
      }

      setTickRanges(ranges);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoadingTicks(false);
    }
  }, [connection]);

  const selectPool = async (pool: PoolData) => {
    setSelectedPool(pool);
    setStep("select-position");
    await fetchTickRanges(pool);
  };

  const selectRange = (range: TickRange) => {
    setSelectedRange(range);
    setLiquidity(range.liquidityGross.toString());
    setAmount0Min("0");
    setAmount1Min("0");
    setStep("configure");
  };

  const goBackToPools = () => {
    setStep("select-pool");
    setSelectedPool(null);
    setTickRanges([]);
  };

  const goBackToPositions = () => {
    setStep("select-position");
    setSelectedRange(null);
    setLiquidity("");
    setAmount0Min("0");
    setAmount1Min("0");
  };

  const removeMax = () => {
    if (selectedRange) {
      setLiquidity(selectedRange.liquidityGross.toString());
    }
  };

  const outsideRangeWarning = useMemo(() => {
    if (!selectedPool || !selectedRange) return null;
    const currentTick = selectedPool.currentTick;
    if (
      currentTick < selectedRange.tickLower ||
      currentTick >= selectedRange.tickUpper
    ) {
      return `Current tick (${currentTick}) is outside the selected range (${selectedRange.tickLower} to ${selectedRange.tickUpper}). Removing liquidity may not be possible or may return zero tokens.`;
    }
    return null;
  }, [selectedPool, selectedRange]);

  const preview = useMemo(() => {
    if (!selectedRange || !liquidity) return null;
    const liq = parseFloat(liquidity);
    if (isNaN(liq) || liq <= 0) return null;
    const est = estimateTokensForRange(
      selectedRange.tickLower,
      selectedRange.tickUpper,
      selectedPool?.currentTick ?? 0,
      liquidity
    );
    return { token0: est.estToken0, token1: est.estToken1 };
  }, [selectedRange, liquidity, selectedPool]);

  const formatBigInt = (val: bigint | string) => {
    const num = typeof val === "string" ? BigInt(val) : val;
    if (num > BigInt(1_000_000_000_000)) return `${(Number(num) / 1_000_000_000_000).toFixed(1)}T`;
    if (num > BigInt(1_000_000)) return `${(Number(num) / 1_000_000).toFixed(1)}M`;
    return num.toString();
  };

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === "select-pool"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                1
              </span>
              <span
                className={`text-sm font-medium ${
                  step === "select-pool"
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                Select Pool
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === "select-position" ||
                  step === "configure"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : step === "select-pool"
                    ? "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                2
              </span>
              <span
                className={`text-sm font-medium ${
                  step === "select-position" || step === "configure"
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                Select Position
              </span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className="flex items-center gap-2">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  step === "configure"
                    ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                }`}
              >
                3
              </span>
              <span
                className={`text-sm font-medium ${
                  step === "configure"
                    ? "text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                Configure
              </span>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Decrease Liquidity
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Remove liquidity from a concentrated liquidity position.
          </p>
        </div>

        <div className="p-8">
          {step === "select-pool" && (
            <div>
              <button
                className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                onClick={fetchPools}
                disabled={loading}
              >
                {loading ? "Fetching..." : fetched ? "Refresh Pools" : "Fetch Pools"}
              </button>

              {error && (
                <div className="mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Error</p>
                  <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{error}</pre>
                </div>
              )}

              {fetched && !loading && pools.length === 0 && (
                <div className="mt-6 text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                  No pools found.
                </div>
              )}

              {pools.length > 0 && (
                <div className="mt-8 space-y-4" role="list" aria-label="Pool list">
                  {pools.map((pool) => (
                    <article
                      key={pool.address}
                      className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 transition-shadow hover:shadow-md cursor-pointer"
                      role="listitem"
                      onClick={() => selectPool(pool)}
                      onKeyDown={(e) => e.key === "Enter" && selectPool(pool)}
                      tabIndex={0}
                    >
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                          {shortAddr(pool.address)}
                        </span>
                        <span className="text-xs font-medium px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                          tick {pool.currentTick}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 0</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(pool.tokenMint0)}</code>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 1</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(pool.tokenMint1)}</code>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Liquidity</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.liquidity.toString()}</code>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Price</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{formatPrice(pool.price)}</code>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Tick Spacing</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.tickSpacing.toString()}</code>
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">sqrtPriceX64</span>
                          <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.sqrtPriceX64.toString()}</code>
                        </div>
                      </div>

                      <details className="mt-4 group">
                        <summary className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer select-none flex items-center gap-1.5 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                          <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Full addresses
                        </summary>
                        <div className="mt-3 space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-1.5 sm:col-span-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Pool PDA</span>
                            <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.address}</code>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Vault 0</span>
                            <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.tokenVault0}</code>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Vault 1</span>
                            <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.tokenVault1}</code>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Mint 0</span>
                            <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.tokenMint0}</code>
                          </div>
                          <div className="flex flex-col gap-1.5 sm:col-span-6">
                            <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Mint 1</span>
                            <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{pool.tokenMint1}</code>
                          </div>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "select-position" && selectedPool && (
            <div className="animate-fade-in">
              <button
                className="mb-6 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5"
                onClick={goBackToPools}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to pools
              </button>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                    {shortAddr(selectedPool.address)}
                  </span>
                  <span className="text-xs font-medium px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    tick {selectedPool.currentTick}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 0</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(selectedPool.tokenMint0)}</code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 1</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(selectedPool.tokenMint1)}</code>
                  </div>
                </div>
              </div>

              {loadingTicks ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">Loading positions...</div>
              ) : tickRanges.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">No positions with liquidity found.</div>
              ) : (
                <div className="space-y-3" role="list" aria-label="Position list">
                  {tickRanges.map((range) => (
                    <div
                      key={`${range.tickLower}-${range.tickUpper}`}
                      className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-shadow hover:shadow-md cursor-pointer"
                      role="listitem"
                      onClick={() => selectRange(range)}
                      onKeyDown={(e) => e.key === "Enter" && selectRange(range)}
                      tabIndex={0}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                            {range.tickLower} → {range.tickUpper}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ~{range.estToken0} Token 0 / ~{range.estToken1} Token 1
                          </span>
                        </div>
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                          liq {formatBigInt(range.liquidityGross)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "configure" && selectedPool && selectedRange && (
            <div className="animate-fade-in space-y-6">
              <button
                className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors flex items-center gap-1.5"
                onClick={goBackToPositions}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to positions
              </button>

              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                    {shortAddr(selectedPool.address)}
                  </span>
                  <span className="text-xs font-medium px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    tick {selectedPool.currentTick}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 0</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(selectedPool.tokenMint0)}</code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Token 1</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{shortAddr(selectedPool.tokenMint1)}</code>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Selected Range</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Lower Tick</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{selectedRange.tickLower}</code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Upper Tick</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{selectedRange.tickUpper}</code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Price Lower</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
                      {selectedRange.priceLower < 0.0001
                        ? selectedRange.priceLower.toExponential(4)
                        : selectedRange.priceLower.toFixed(6)}
                    </code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Price Upper</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
                      {selectedRange.priceUpper < 0.0001
                        ? selectedRange.priceUpper.toExponential(4)
                        : selectedRange.priceUpper.toFixed(6)}
                    </code>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Available Liquidity</span>
                    <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">{selectedRange.liquidityGross}</code>
                  </div>
                </div>
              </div>

              {BigInt(selectedRange.liquidityGross) === BigInt(0) && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm">
                  This position has no liquidity.
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Liquidity to Remove
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 3338502497097"
                      value={liquidity}
                      onChange={(e) => setLiquidity(e.target.value)}
                      className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl font-medium text-sm text-gray-700 dark:text-gray-200 cursor-pointer transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={removeMax}
                      disabled={!selectedRange}
                    >
                      Remove Max
                    </button>
                  </div>
                </div>

                <details className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 cursor-pointer select-none flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                    <svg className="w-4 h-4 group-open:rotate-90 transition-transform text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Advanced (Slippage Protection)
                  </summary>
                  <div className="p-4 space-y-4 bg-white dark:bg-gray-900">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Amount 0 Min (u64)</label>
                      <input
                        type="text"
                        value={amount0Min}
                        onChange={(e) => setAmount0Min(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Amount 1 Min (u64)</label>
                      <input
                        type="text"
                        value={amount1Min}
                        onChange={(e) => setAmount1Min(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                      />
                    </div>
                  </div>
                </details>

                {outsideRangeWarning && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{outsideRangeWarning}</pre>
                  </div>
                )}

                {preview && (
                  <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">You will receive:</span>
                    <code className="block mt-1 text-sm font-mono text-blue-600 dark:text-blue-400">
                      ~{preview.token0} Token 0 / ~{preview.token1} Token 1
                    </code>
                  </div>
                )}

                <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {!wallet ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 text-sm">Connect your wallet to submit.</p>
                  ) : (
                    <button
                      className="w-full px-6 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                      onClick={submit}
                      disabled={
                        isSubmitting ||
                        !!validationError ||
                        BigInt(selectedRange.liquidityGross) === BigInt(0)
                      }
                    >
                      {isSubmitting ? "Submitting..." : "Remove Liquidity"}
                    </button>
                  )}

                  {validationError && (
                    <p className="text-center text-sm text-red-700 dark:text-red-300">{validationError}</p>
                  )}
                </div>

                {txError && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{txError}</pre>
                  </div>
                )}

                {txSignature && (
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <pre className="text-xs text-green-700 dark:text-green-300 font-mono whitespace-pre-wrap break-all leading-relaxed mb-2">Transaction confirmed!</pre>
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Explorer
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}