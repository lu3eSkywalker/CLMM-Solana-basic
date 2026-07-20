"use client";

import { useState, useCallback, useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { useProgram } from "@/utils/program";
import {
  findPoolStatePda,
  findTokenVaultPda,
  findTickArrayPda,
  sortTokenMints,
} from "@/utils/pda";
import {
  PositionStrategy,
  PositionData,
  BaseRange,
  hasBaseRange,
  tickArrayStartIndex,
  TICKS_PER_ARRAY,
} from "./types";

interface UseOpenPositionParams {
  strategy: PositionStrategy;
  poolAddress: string;
  baseRange: BaseRange;
  positions: PositionData[];
}

interface UseOpenPositionReturn {
  submit: () => Promise<string | null>;
  isSubmitting: boolean;
  error: string | null;
  txSignature: string | null;
  validationError: string | null;
}

function getSqrtPriceAtTick(tick: number): BN {
  const absTick = Math.abs(tick);
  const Q64 = new BN(1).shln(64);

  let ratio: BN;
  if ((absTick & 1) !== 0) {
    ratio = new BN("fffcb933bd6fb800", 16);
  } else {
    ratio = new BN(Q64);
  }

  if ((absTick & 2) !== 0)
    ratio = ratio.mul(new BN("fff97272373d4000", 16)).shrn(64);
  if ((absTick & 4) !== 0)
    ratio = ratio.mul(new BN("fff2e50f5f657000", 16)).shrn(64);
  if ((absTick & 8) !== 0)
    ratio = ratio.mul(new BN("ffe5caca7e10f000", 16)).shrn(64);
  if ((absTick & 16) !== 0)
    ratio = ratio.mul(new BN("ffcb9843d60f7000", 16)).shrn(64);
  if ((absTick & 32) !== 0)
    ratio = ratio.mul(new BN("ff973b41fa98e800", 16)).shrn(64);
  if ((absTick & 64) !== 0)
    ratio = ratio.mul(new BN("ff2ea16466c9b000", 16)).shrn(64);
  if ((absTick & 128) !== 0)
    ratio = ratio.mul(new BN("fe5dee046a9a3800", 16)).shrn(64);
  if ((absTick & 256) !== 0)
    ratio = ratio.mul(new BN("fcbe86c7900bb000", 16)).shrn(64);
  if ((absTick & 512) !== 0)
    ratio = ratio.mul(new BN("f987a7253ac65800", 16)).shrn(64);
  if ((absTick & 1024) !== 0)
    ratio = ratio.mul(new BN("f3392b0822bb6000", 16)).shrn(64);
  if ((absTick & 2048) !== 0)
    ratio = ratio.mul(new BN("e7159475a2caf000", 16)).shrn(64);
  if ((absTick & 4096) !== 0)
    ratio = ratio.mul(new BN("d097f3bdfd2f2000", 16)).shrn(64);
  if ((absTick & 8192) !== 0)
    ratio = ratio.mul(new BN("a9f746462d9f8000", 16)).shrn(64);
  if ((absTick & 16384) !== 0)
    ratio = ratio.mul(new BN("70d869a156f31c00", 16)).shrn(64);
  if ((absTick & 32768) !== 0)
    ratio = ratio.mul(new BN("31be135f97ed3200", 16)).shrn(64);

  if (tick > 0) {
    const U128_MAX = new BN(1).shln(128).sub(new BN(1));
    ratio = U128_MAX.div(ratio);
  }

  return ratio;
}

function sqrtPriceToLiquidity(
  sqrtPriceA: number,
  sqrtPriceB: number,
  amount: number
): BN {
  if (sqrtPriceA === sqrtPriceB) return new BN(0);
  const liq = Math.floor(
    (amount * sqrtPriceA * sqrtPriceB) / (sqrtPriceB - sqrtPriceA)
  );
  return new BN(Math.abs(liq).toString());
}

export function useOpenPosition({
  strategy,
  poolAddress,
  baseRange,
  positions,
}: UseOpenPositionParams): UseOpenPositionReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const program = useProgram();
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  const validationError = useMemo(() => {
    if (!poolAddress) return "Enter a pool address";
    try {
      new PublicKey(poolAddress.trim());
    } catch {
      return "Invalid pool address";
    }

    if (hasBaseRange(strategy)) {
      if (baseRange.tickLower >= baseRange.tickUpper)
        return "Base range: min tick must be less than max tick";
    }

    if (positions.length === 0) return "Add at least one position";

    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      if (p.tickLower >= p.tickUpper)
        return `Position ${i + 1}: min tick must be less than max tick`;
      const liq = parseFloat(p.liquidity);
      if (isNaN(liq) || liq <= 0)
        return `Position ${i + 1}: enter a valid liquidity amount`;
    }

    return null;
  }, [strategy, poolAddress, baseRange, positions]);

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
      const poolPk = new PublicKey(poolAddress.trim());

      const poolAccountInfo = await connection.getAccountInfo(poolPk);
      if (!poolAccountInfo) {
        throw new Error("Pool account not found. Make sure the pool exists.");
      }

      const poolAccountData = poolAccountInfo.data;
      const tokenMint0 = new PublicKey(poolAccountData.slice(40, 72));
      const tokenMint1 = new PublicKey(poolAccountData.slice(72, 104));

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

      const instructions: TransactionInstruction[] = [];

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

      const sqrtPriceCurrent = getSqrtPriceAtTick(0);
      const PRICE_MAX_U128 = new BN(
        "340282366920938463463374607431768211455"
      );
      const PRICE_MIN_U128 = new BN("4295048016");

      const buildOpenPositionIx = async (
        tickLower: number,
        tickUpper: number,
        liquidity: BN
      ) => {
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

        return program.methods
          .openPosition(
            tickLower,
            tickUpper,
            tickArrayLowerStart,
            tickArrayUpperStart,
            liquidity,
            new BN("18446744073709551615"),
            new BN("18446744073709551615")
          )
          .accounts({
            payer: wallet.publicKey,
            poolState: poolPk,
            tickArrayLower: tickArrayLowerPda,
            tickArrayUpper: tickArrayUpperPda,
            tokenAccount0: userTokenAccount0,
            tokenAccount1: userTokenAccount1,
            tokenVault0: tokenVault0Pda,
            tokenVault1: tokenVault1Pda,
            rent: new PublicKey(
              "SysvarRent111111111111111111111111111111111"
            ),
            systemProgram: PublicKey.default,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .instruction();
      };

      const buildIncreaseLiquidityIx = async (
        tickLower: number,
        tickUpper: number,
        liquidity: BN
      ) => {
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

        return program.methods
          .increaseLiquidity(
            liquidity,
            new BN("18446744073709551615"),
            new BN("18446744073709551615"),
            tickLower,
            tickUpper
          )
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
          } as any)
          .instruction();
      };

      const sqrtP = Math.sqrt(1);
      const sqrtAtLower = Math.sqrt(Math.pow(1.0001, baseRange.tickLower));
      const sqrtAtUpper = Math.sqrt(Math.pow(1.0001, baseRange.tickUpper));

      if (strategy === PositionStrategy.SINGLE_BASE) {
        const pos = positions[0];
        const liq = sqrtPriceToLiquidity(
          sqrtAtLower,
          sqrtAtUpper,
          parseFloat(pos.liquidity)
        );
        const ix = await buildOpenPositionIx(
          pos.tickLower,
          pos.tickUpper,
          liq
        );
        instructions.push(ix);
      } else if (strategy === PositionStrategy.SINGLE_BASE_OVERLAP) {
        const baseLiq = sqrtPriceToLiquidity(
          sqrtAtLower,
          sqrtAtUpper,
          50e9
        );
        const baseIx = await buildOpenPositionIx(
          baseRange.tickLower,
          baseRange.tickUpper,
          baseLiq
        );
        instructions.push(baseIx);

        for (const pos of positions) {
          const sL = Math.sqrt(Math.pow(1.0001, pos.tickLower));
          const sU = Math.sqrt(Math.pow(1.0001, pos.tickUpper));
          const liq = sqrtPriceToLiquidity(
            sL,
            sU,
            parseFloat(pos.liquidity)
          );
          const ix = await buildIncreaseLiquidityIx(
            pos.tickLower,
            pos.tickUpper,
            liq
          );
          instructions.push(ix);
        }
      } else if (
        strategy === PositionStrategy.MULTI_INDEPENDENT ||
        strategy === PositionStrategy.MULTI_INDEPENDENT_OVERLAP
      ) {
        for (const pos of positions) {
          const sL = Math.sqrt(Math.pow(1.0001, pos.tickLower));
          const sU = Math.sqrt(Math.pow(1.0001, pos.tickUpper));
          const liq = sqrtPriceToLiquidity(
            sL,
            sU,
            parseFloat(pos.liquidity)
          );
          const ix = await buildOpenPositionIx(
            pos.tickLower,
            pos.tickUpper,
            liq
          );
          instructions.push(ix);
        }
      }

      const tx = new Transaction();
      for (const ix of instructions) {
        tx.add(ix);
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
      console.error("Open position error:", err);
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
    strategy,
    poolAddress,
    baseRange,
    positions,
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
