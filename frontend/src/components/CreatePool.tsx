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
        } as any)
        .rpc();

      await program.provider.connection.confirmTransaction(tx);

      setResult({
        type: "success",
        message: `Pool created successfully!\n\nPool PDA: ${poolStatePda.toBase58()}\nVault 0: ${tokenVault0Pda.toBase58()}\nVault 1: ${tokenVault1Pda.toBase58()}\n\nTx: ${tx}`,
      });
    } catch (err: any) {
      console.error(err);
      setResult({
        type: "error",
        message: err?.message || "Transaction failed",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Create Pool</h2>
      <p className="card-desc">
        Create a new concentrated liquidity pool for two SPL tokens.
      </p>

      <div className="form-group">
        <label>Token Mint A</label>
        <input
          type="text"
          placeholder="e.g. 2yUWpgR1cX453hmxnh7RJEspfoBt2JVzWyUKniXzVheY"
          value={tokenMintA}
          onChange={(e) => setTokenMintA(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Token Mint B</label>
        <input
          type="text"
          placeholder="e.g. 3fKqu7JLynEkyooG6TvBmq4djU6jsHuPivTcLgpKfhQQ"
          value={tokenMintB}
          onChange={(e) => setTokenMintB(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Initial Price (Token A in terms of Token B)</label>
        <input
          type="text"
          placeholder="e.g. 1"
          value={initialPrice}
          onChange={(e) => setInitialPrice(e.target.value)}
        />
      </div>

      {tokenMintA && tokenMintB && (
        <div className="preview">
          <span className="preview-label">Pool Preview</span>
          <code>
            {(() => {
              try {
                const sorted = sortTokenMints(
                  new PublicKey(tokenMintA),
                  new PublicKey(tokenMintB)
                );
                return `${sorted.mint0.toBase58().slice(0, 8)}... / ${sorted.mint1.toBase58().slice(0, 8)}...`;
              } catch {
                return "Invalid mint addresses";
              }
            })()}
          </code>
        </div>
      )}

      <button
        className="btn-primary"
        onClick={handleCreatePool}
        disabled={loading || !wallet}
      >
        {loading ? "Creating Pool..." : "Create Pool"}
      </button>

      {!wallet && (
        <p className="hint">Connect your wallet to create a pool</p>
      )}

      {result && (
        <div className={`result ${result.type}`}>
          <pre>{result.message}</pre>
        </div>
      )}
    </div>
  );
}
