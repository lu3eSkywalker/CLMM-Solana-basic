"use client";

import { useState, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";
import { useIncreaseLiquidity } from "./useIncreaseLiquidity";
import { TICKS_PER_ARRAY } from "@/components/OpenPosition/types";
import { PoolData, TickArrayData, DEFAULT_U64_MAX } from "./types";

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatPrice(price: number) {
  return price < 0.0001 ? price.toExponential(4) : price.toFixed(6);
}

function createReadOnlyWallet() {
  return {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async (tx: unknown) => tx,
    signAllTransactions: async (txs: unknown) => txs,
  };
}

export function IncreaseLiquidityPage() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const [step, setStep] = useState<"select-pool" | "select-position">("select-pool");
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);
  const [tickArrays, setTickArrays] = useState<TickArrayData[]>([]);
  const [loadingTicks, setLoadingTicks] = useState(false);

  const [tickLower, setTickLower] = useState(0);
  const [tickUpper, setTickUpper] = useState(19);
  const [liquidity, setLiquidity] = useState("");
  const [amount0Max, setAmount0Max] = useState(DEFAULT_U64_MAX);
  const [amount1Max, setAmount1Max] = useState(DEFAULT_U64_MAX);

  const {
    submit,
    isSubmitting,
    error: txError,
    txSignature,
    validationError,
  } = useIncreaseLiquidity({
    pool: selectedPool!,
    tickLower,
    tickUpper,
    liquidity,
    amount0Max,
    amount1Max,
  });

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const readOnlyWallet = createReadOnlyWallet();

      const provider = new AnchorProvider(connection, readOnlyWallet as unknown as AnchorProvider["wallet"], {
        commitment: "confirmed",
      });

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

  const fetchTickArrays = useCallback(
    async (poolPk: string) => {
      setLoadingTicks(true);
      try {
        const readOnlyWallet = createReadOnlyWallet();

        const provider = new AnchorProvider(connection, readOnlyWallet as unknown as AnchorProvider["wallet"], {
          commitment: "confirmed",
        });

        const program = new Program<ClmmBasic>(IDL as ClmmBasic, provider);
        const accounts = await program.account.tickArrayState.all();

        const filtered = accounts
          .filter((acc) => acc.account.poolId.toBase58() === poolPk)
          .map((acc) => ({
            address: acc.publicKey.toBase58(),
            poolId: acc.account.poolId.toBase58(),
            startTickIndex: acc.account.startTickIndex,
            initializedTickCount: acc.account.initializedTickCount,
          }));

        setTickArrays(filtered);
      } catch (err: unknown) {
        console.error("Failed to fetch tick arrays:", err);
      } finally {
        setLoadingTicks(false);
      }
    },
    [connection]
  );

  const selectPool = (pool: PoolData) => {
    setSelectedPool(pool);
    setStep("select-position");
    fetchTickArrays(pool.address);
  };

  const goBackToPools = () => {
    setStep("select-pool");
    setSelectedPool(null);
    setTickArrays([]);
    setLiquidity("");
    setTickLower(0);
    setTickUpper(19);
  };

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Increase Liquidity</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Add liquidity to an existing pool position.
          </p>
        </div>

        <div className="p-8 space-y-8">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4">
            <div className={`flex items-center gap-2 ${step === "select-pool" ? "text-blue-600 dark:text-blue-400" : "text-green-600 dark:text-green-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === "select-pool" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"}`}>
                1
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Select Pool</span>
            </div>
            <div className="w-16 h-0.5 bg-gray-200 dark:bg-gray-700" />
            <div className={`flex items-center gap-2 ${step === "select-position" ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${step === "select-position" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"}`}>
                2
              </div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Configure & Submit</span>
            </div>
          </div>

          {step === "select-pool" && (
            <div className="space-y-6">
              <button
                className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                onClick={fetchPools}
                disabled={loading}
              >
                {loading ? "Fetching..." : fetched ? "Refresh Pools" : "Fetch Pools"}
              </button>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Error</p>
                  <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{error}</pre>
                </div>
              )}

              {fetched && !loading && pools.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                  No pools available.
                </div>
              )}

              {pools.length > 0 && (
                <div className="space-y-4" role="list" aria-label="Pool list">
                  {pools.map((pool) => (
                    <article
                      key={pool.address}
                      className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 transition-shadow hover:shadow-md cursor-pointer"
                      role="listitem"
                      onClick={() => selectPool(pool)}
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && selectPool(pool)}
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
                        <PoolField label="Token 0" value={shortAddr(pool.tokenMint0)} />
                        <PoolField label="Token 1" value={shortAddr(pool.tokenMint1)} />
                        <PoolField label="Liquidity" value={pool.liquidity.toString()} />
                        <PoolField label="Price" value={formatPrice(pool.price)} />
                        <PoolField label="Tick Spacing" value={pool.tickSpacing.toString()} />
                        <PoolField label="Current Tick" value={pool.currentTick.toString()} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === "select-position" && selectedPool && (
            <div className="space-y-6">
              <button
                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 transition-colors flex items-center gap-1.5"
                onClick={goBackToPools}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to pools
              </button>

              <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-lg">
                    {shortAddr(selectedPool.address)}
                  </span>
                  <span className="text-xs font-medium px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full">
                    tick {selectedPool.currentTick}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <PoolField label="Token 0" value={shortAddr(selectedPool.tokenMint0)} />
                  <PoolField label="Token 1" value={shortAddr(selectedPool.tokenMint1)} />
                  <PoolField label="Price" value={formatPrice(selectedPool.price)} />
                  <PoolField label="Liquidity" value={selectedPool.liquidity.toString()} />
                </div>
              </div>

              {tickArrays.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Available Tick Arrays</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      Click a tick array to pre-fill the range inputs.
                    </p>
                    <div className="space-y-2">
                      {tickArrays.map((ta) => (
                        <button
                          key={ta.address}
                          className="w-full text-left p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
                          onClick={() => {
                            setTickLower(ta.startTickIndex);
                            setTickUpper(ta.startTickIndex + TICKS_PER_ARRAY);
                          }}
                        >
                          <span className="font-mono text-gray-900 dark:text-gray-100">
                            {ta.startTickIndex} → {ta.startTickIndex + TICKS_PER_ARRAY}
                          </span>
                          <span className="text-xs font-medium px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                            {ta.initializedTickCount} ticks
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {loadingTicks && (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Loading tick arrays...
                </div>
              )}

              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Position Range</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Tick Lower
                    </label>
                    <input
                      type="number"
                      value={tickLower}
                      onChange={(e) => setTickLower(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Tick Upper
                    </label>
                    <input
                      type="number"
                      value={tickUpper}
                      onChange={(e) => setTickUpper(Number(e.target.value))}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Liquidity Amount
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1000000"
                    value={liquidity}
                    onChange={(e) => setLiquidity(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                </div>
              </div>

              <details className="group">
                <summary className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer select-none flex items-center gap-1.5 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                  <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Advanced (Slippage Limits)
                </summary>
                <div className="mt-4 space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Amount 0 Max (u64)
                    </label>
                    <input
                      type="text"
                      value={amount0Max}
                      onChange={(e) => setAmount0Max(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                      Amount 1 Max (u64)
                    </label>
                    <input
                      type="text"
                      value={amount1Max}
                      onChange={(e) => setAmount1Max(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                </div>
              </details>

              <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {!wallet ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                    Connect your wallet to submit.
                  </p>
                ) : (
                  <button
                    className="w-full px-6 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
                    onClick={submit}
                    disabled={isSubmitting || !!validationError}
                  >
                    {isSubmitting ? "Submitting..." : "Increase Liquidity"}
                  </button>
                )}

                {validationError && (
                  <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">{validationError}</p>
                  </div>
                )}

                {txError && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <pre className="text-xs text-red-700 dark:text-red-300 font-mono whitespace-pre-wrap break-all leading-relaxed">{txError}</pre>
                  </div>
                )}

                {txSignature && (
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Transaction confirmed!</p>
                    <a
                      href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline"
                    >
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

function PoolField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
        {value}
      </code>
    </div>
  );
}