"use client";

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Keypair } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";
import { PROGRAM_ID } from "@/utils/pda";

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
        signTransaction: async (tx: any) => tx,
        signAllTransactions: async (txs: any) => txs,
      };

      const provider = new AnchorProvider(connection, readOnlyWallet as any, {
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
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to fetch pools");
    } finally {
      setLoading(false);
    }
  }, [connection]);

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="card">
      <h2>Pools</h2>
      <p className="card-desc">
        All liquidity pools deployed by this program on devnet.
      </p>

      <button
        className="btn-primary"
        onClick={fetchPools}
        disabled={loading}
      >
        {loading ? "Fetching..." : fetched ? "Refresh" : "Fetch Pools"}
      </button>

      {error && (
        <div className="result error" style={{ marginTop: 16 }}>
          <pre>{error}</pre>
        </div>
      )}

      {fetched && !loading && pools.length === 0 && (
        <div className="hint" style={{ marginTop: 16 }}>
          No pools found.
        </div>
      )}

      {pools.length > 0 && (
        <div className="pool-list">
          {pools.map((pool) => (
            <div key={pool.address} className="pool-row">
              <div className="pool-header">
                <span className="pool-addr">{shortAddr(pool.address)}</span>
                <span className="pool-tick-badge">
                  tick {pool.currentTick}
                </span>
              </div>

              <div className="pool-grid">
                <div className="pool-cell">
                  <span className="pool-label">Token 0</span>
                  <code>{shortAddr(pool.tokenMint0)}</code>
                </div>
                <div className="pool-cell">
                  <span className="pool-label">Token 1</span>
                  <code>{shortAddr(pool.tokenMint1)}</code>
                </div>
                <div className="pool-cell">
                  <span className="pool-label">Liquidity</span>
                  <code>{pool.liquidity.toString()}</code>
                </div>
                <div className="pool-cell">
                  <span className="pool-label">Price</span>
                  <code>{pool.price < 0.0001 ? pool.price.toExponential(4) : pool.price.toFixed(6)}</code>
                </div>
                <div className="pool-cell">
                  <span className="pool-label">Tick Spacing</span>
                  <code>{pool.tickSpacing}</code>
                </div>
                <div className="pool-cell">
                  <span className="pool-label">sqrtPriceX64</span>
                  <code>{pool.sqrtPriceX64.toString()}</code>
                </div>
              </div>

              <details className="pool-details">
                <summary>Full addresses</summary>
                <div className="pool-detail-grid">
                  <div>
                    <span className="pool-label">Pool PDA</span>
                    <code>{pool.address}</code>
                  </div>
                  <div>
                    <span className="pool-label">Vault 0</span>
                    <code>{pool.tokenVault0}</code>
                  </div>
                  <div>
                    <span className="pool-label">Vault 1</span>
                    <code>{pool.tokenVault1}</code>
                  </div>
                  <div>
                    <span className="pool-label">Mint 0</span>
                    <code>{pool.tokenMint0}</code>
                  </div>
                  <div>
                    <span className="pool-label">Mint 1</span>
                    <code>{pool.tokenMint1}</code>
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}