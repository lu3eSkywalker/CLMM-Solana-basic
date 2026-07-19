"use client";

import { useState } from "react";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useProgram } from "@/utils/program";
import {
  findPoolStatePda,
  findTokenVaultPda,
  sortTokenMints,
} from "@/utils/pda";

export function CreatePool() {
  const wallet = useAnchorWallet();
  const program = useProgram();

  const [tokenMintA, setTokenMintA] = useState("");
  const [tokenMintB, setTokenMintB] = useState("");
  const [initialPrice, setInitialPrice] = useState("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleCreatePool = async () => {
    if (!wallet || !program) {
      setResult({ type: "error", message: "Connect your wallet first" });
      return;
    }

    if (!tokenMintA || !tokenMintB) {
      setResult({ type: "error", message: "Enter both token mint addresses" });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const mintA = new PublicKey(tokenMintA.trim());
      const mintB = new PublicKey(tokenMintB.trim());

      const { mint0, mint1 } = sortTokenMints(mintA, mintB);

      const [poolStatePda] = findPoolStatePda(mint0, mint1);
      const [tokenVault0Pda] = findTokenVaultPda(poolStatePda, mint0);
      const [tokenVault1Pda] = findTokenVaultPda(poolStatePda, mint1);

      const price = parseFloat(initialPrice);
      if (isNaN(price) || price <= 0) {
        throw new Error("Price must be a positive number");
      }

      const sqrtPriceX64 = new BN(
        BigInt(Math.floor(Math.sqrt(price) * 2 ** 64))
      );

      const tx = await program.methods
        .createPool(sqrtPriceX64)
        .accounts({
          poolCreator: wallet.publicKey,
          poolState: poolStatePda,
          tokenMint0: mint0,
          tokenMint1: mint1,
          tokenVault0: tokenVault0Pda,
          tokenVault1: tokenVault1Pda,
          tokenProgram0: TOKEN_PROGRAM_ID,
          tokenProgram1: TOKEN_PROGRAM_ID,
          systemProgram: PublicKey.default,
          rent: new PublicKey("SysvarRent111111111111111111111111111111111"),
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .rpc();

      await program.provider.connection.confirmTransaction(tx);

      setResult({
        type: "success",
        message: `Pool created successfully!\n\nPool PDA: ${poolStatePda.toBase58()}\nVault 0: ${tokenVault0Pda.toBase58()}\nVault 1: ${tokenVault1Pda.toBase58()}\n\nTx: ${tx}`,
      });
    } catch (err: unknown) {
      console.error(err);
      setResult({
        type: "error",
        message: err instanceof Error ? err.message : "Transaction failed",
      });
    } finally {
      setLoading(false);
    }
  };

  const shortAddr = (addr: string) =>
    `${addr.slice(0, 8)}...${addr.slice(-4)}`;

  const getPoolPreview = () => {
    if (!tokenMintA || !tokenMintB) return null;
    try {
      const sorted = sortTokenMints(
        new PublicKey(tokenMintA),
        new PublicKey(tokenMintB)
      );
      return `${shortAddr(sorted.mint0.toBase58())} / ${shortAddr(sorted.mint1.toBase58())}`;
    } catch {
      return "Invalid mint addresses";
    }
  };

  return (
    <div className="min-h-[calc(50vh-4rem)] flex items-center justify-center px-4 py-12 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
        <div className="p-8 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Create Pool</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Create a new concentrated liquidity pool for two SPL tokens.
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Token Mint A
            </label>
            <input
              type="text"
              placeholder="e.g. 2yUWpgR1cX453hmxnh7RJEspfoBt2JVzWyUKniXzVheY"
              value={tokenMintA}
              onChange={(e) => setTokenMintA(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Token Mint B
            </label>
            <input
              type="text"
              placeholder="e.g. 3fKqu7JLynEkyooG6TvBmq4djU6jsHuPivTcLgpKfhQQ"
              value={tokenMintB}
              onChange={(e) => setTokenMintB(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Initial Price (Token A in terms of Token B)
            </label>
            <input
              type="text"
              placeholder="e.g. 1"
              value={initialPrice}
              onChange={(e) => setInitialPrice(e.target.value)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-gray-100 text-sm font-mono outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>

          {getPoolPreview() && (
            <div className="flex items-center gap-3 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Pool Preview
              </span>
              <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                {getPoolPreview()}
              </code>
            </div>
          )}

          <button
            className="w-full px-6 py-4 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl font-semibold text-base cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
            onClick={handleCreatePool}
            disabled={loading || !wallet}
          >
            {loading ? "Creating Pool..." : "Create Pool"}
          </button>

          {!wallet && (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
              Connect your wallet to create a pool
            </p>
          )}

          {result && (
            <div
              className={`p-4 rounded-xl text-xs ${
                result.type === "success"
                  ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              }`}
            >
              <pre className={`whitespace-pre-wrap break-all font-mono leading-relaxed ${
                result.type === "success"
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}>
                {result.message}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}