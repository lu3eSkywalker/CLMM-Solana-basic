"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";

interface PoolData {
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
}

export function FetchPools() {
  const { connection } = useConnection();
  const [pools, setPools] = useState<PoolData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);

  const fetchPools = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const readOnlyWallet = {
        publicKey: Keypair.generate().publicKey,
        signTransaction: async (tx: unknown) => tx,
        signAllTransactions: async (txs: unknown) => txs,
      };

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

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatPrice = (price: number) =>
    price < 0.0001 ? price.toExponential(4) : price.toFixed(6);

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Pools</h2>
          <p className="text-gray-500 dark:text-gray-400">
            All liquidity pools deployed by this program on devnet.
          </p>
        </div>

        <div className="p-8">
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
            <div className="mt-8 space-y-6" role="list" aria-label="Pool list">
              {pools.map((pool) => (
                <article
                  key={pool.address}
                  className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 transition-shadow hover:shadow-md"
                  role="listitem"
                >
                  <div className="flex flex-wrap items-center gap-3 mb-5">
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
                    <PoolField label="sqrtPriceX64" value={pool.sqrtPriceX64.toString()} />
                  </div>

                  <details className="mt-5 group">
                    <summary className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer select-none flex items-center gap-1.5 hover:text-blue-500 dark:hover:text-blue-300 transition-colors">
                      <svg className="w-4 h-4 group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      Full addresses
                    </summary>
                    <div className="mt-4 space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <PoolField label="Pool PDA" value={pool.address} fullWidth />
                      <PoolField label="Vault 0" value={pool.tokenVault0} fullWidth />
                      <PoolField label="Vault 1" value={pool.tokenVault1} fullWidth />
                      <PoolField label="Mint 0" value={pool.tokenMint0} fullWidth />
                      <PoolField label="Mint 1" value={pool.tokenMint1} fullWidth />
                    </div>
                  </details>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PoolField({ label, value, fullWidth }: { label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "sm:col-span-6" : ""}`}>
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <code className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
        {value}
      </code>
    </div>
  );
}