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
import { PoolData, DEFAULT_U64_MAX } from "./types";

interface UseIncreaseLiquidityParams {
  pool: PoolData;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
  amount0Max: string;
  amount1Max: string;
}

interface UseIncreaseLiquidityReturn {
  submit: () => Promise<string | null>;
  isSubmitting: boolean;
  error: string | null;
  txSignature: string | null;
  validationError: string | null;
}

export function useIncreaseLiquidity({
  pool,
  tickLower,
  tickUpper,
  liquidity,
  amount0Max,
  amount1Max,
}: UseIncreaseLiquidityParams): UseIncreaseLiquidityReturn {
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
      const a0Max = new BN(amount0Max || DEFAULT_U64_MAX);
      const a1Max = new BN(amount1Max || DEFAULT_U64_MAX);

const ix = await program.methods
        .increaseLiquidity(liqBn, a0Max, a1Max, tickLower, tickUpper)
        .accounts({
          payer: wallet.publicKey,
          poolState: poolPk,
          tickArrayLower: tickArrayLowerPda,
          tickArrayUpper: tickArrayUpperPda,
          tokenAccount0: userTokenAccount0,
          tokenAccount1: userTokenAccount1,
          tokenVault0: tokenVault0Pda,
          tokenVault1: tokenVault1Pda,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any) // eslint-disable-line @typescript-eslint/no-explicit-any
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
    } catch (err: unknown) {
      console.error("Increase liquidity error:", err);
      const msg =
        err instanceof Error ? err.message : "Transaction failed";
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
    amount0Max,
    amount1Max,
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
