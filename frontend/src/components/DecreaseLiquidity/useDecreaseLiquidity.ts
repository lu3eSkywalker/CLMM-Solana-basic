"use client";

import { useState, useCallback, useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useProgram } from "@/utils/program";
import { findTokenVaultPda, findTickArrayPda } from "@/utils/pda";
import { tickArrayStartIndex } from "@/components/OpenPosition/types";
import { PoolData } from "./types";

interface UseDecreaseLiquidityParams {
  pool: PoolData;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0Min: string;
  amount1Min: string;
}

interface UseDecreaseLiquidityReturn {
  submit: () => Promise<string | null>;
  isSubmitting: boolean;
  error: string | null;
  txSignature: string | null;
  validationError: string | null;
}

export function useDecreaseLiquidity({
  pool,
  tickLower,
  tickUpper,
  liquidity,
  amount0Min,
  amount1Min,
}: UseDecreaseLiquidityParams): UseDecreaseLiquidityReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const program = useProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const validationError = useMemo(() => {
    if (!pool) return "Select a pool first";
    if (tickLower >= tickUpper)
      return "Min tick must be less than max tick";

    const liq = parseFloat(liquidity);
    if (isNaN(liq) || liq <= 0) return "Enter a valid liquidity amount";

    return null;
  }, [pool, tickLower, tickUpper, liquidity]);

  const submit = useCallback(async (): Promise<string | null> => {
    if (!program || !wallet) {
      setError("Connect your wallet first");
      return null;
    }
    if (validationError) {
      setError(validationError);
      return null;
    }

    setIsSubmitting(true);
    setError(null);
    setTxSignature(null);

    try {
      const poolPk = new PublicKey(pool.address);
      const tokenMint0 = new PublicKey(pool.tokenMint0);
      const tokenMint1 = new PublicKey(pool.tokenMint1);

      const [tokenVault0Pda] = findTokenVaultPda(poolPk, tokenMint0);
      const [tokenVault1Pda] = findTokenVaultPda(poolPk, tokenMint1);

      const userTokenAccount0 = getAssociatedTokenAddressSync(
        tokenMint0,
        wallet.publicKey
      );
      const userTokenAccount1 = getAssociatedTokenAddressSync(
        tokenMint1,
        wallet.publicKey
      );

      const instructions = [];

      const ataInfo0 = await connection.getAccountInfo(userTokenAccount0);
      if (!ataInfo0) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userTokenAccount0,
            wallet.publicKey,
            tokenMint0
          )
        );
      }

      const ataInfo1 = await connection.getAccountInfo(userTokenAccount1);
      if (!ataInfo1) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            userTokenAccount1,
            wallet.publicKey,
            tokenMint1
          )
        );
      }

      const tickArrayLowerStart = tickArrayStartIndex(tickLower);
      const tickArrayUpperStart = tickArrayStartIndex(tickUpper);
      const [tickArrayLowerPda] = findTickArrayPda(
        poolPk,
        tickArrayLowerStart
      );
      const [tickArrayUpperPda] = findTickArrayPda(
        poolPk,
        tickArrayUpperStart
      );

      const liqBn = new BN(liquidity);
      const a0Min = new BN(amount0Min || "0");
      const a1Min = new BN(amount1Min || "0");

      const ix = await program.methods
        .decreaseLiquidity(liqBn, a0Min, a1Min, tickLower, tickUpper)
        .accounts({
          poolState: poolPk,
          tokenVault0: tokenVault0Pda,
          tokenVault1: tokenVault1Pda,
          tickArrayLower: tickArrayLowerPda,
          tickArrayUpper: tickArrayUpperPda,
          recipientTokenAccount0: userTokenAccount0,
          recipientTokenAccount1: userTokenAccount1,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .instruction();

      instructions.push(ix);

      const tx = new Transaction();
      for (const i of instructions) {
        tx.add(i);
      }
      tx.feePayer = wallet.publicKey;
      tx.recentBlockhash = (
        await connection.getLatestBlockhash()
      ).blockhash;

      const signedTx = await wallet.signTransaction(tx);
      const txSig = await connection.sendRawTransaction(
        signedTx.serialize()
      );

      await connection.confirmTransaction(txSig, "confirmed");

      setTxSignature(txSig);
      return txSig;
    } catch (err: any) {
      console.error("Decrease liquidity error:", err);
      const msg =
        err?.message || err?.logs?.join("\n") || "Transaction failed";
      setError(msg);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    program,
    wallet,
    connection,
    pool,
    tickLower,
    tickUpper,
    liquidity,
    amount0Min,
    amount1Min,
    validationError,
  ]);

  return {
    submit,
    isSubmitting,
    error,
    txSignature,
    validationError,
  };
}
