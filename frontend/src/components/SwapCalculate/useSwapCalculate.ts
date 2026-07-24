"use client";

import { useState, useCallback } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  getMint,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { ClmmBasic } from "@/types/clmm_basic";
import IDL from "@/idl/clmm_basic.json";
import { PROGRAM_ID, findTokenVaultPda, findTickArrayPda } from "@/utils/pda";
import { useProgram } from "@/utils/program";
import {
  PoolData,
  TickData,
  TickArrayData,
  SwapResult,
  SwapTxState,
} from "./types";
import { TICKS_PER_ARRAY } from "@/components/OpenPosition/types";

const Q64 = BigInt(1) << BigInt(64);
const MIN_TICK = -443636;
const MAX_TICK = 443636;
const MIN_SQRT_PRICE_X64 = BigInt(4295048016);
const MAX_SQRT_PRICE_X64 = BigInt(
  "79226673521066979257578248091"
);

const SQRT_PRICES_1 = [
  BigInt("0xfffcb933bd6fb800"),
  BigInt("0xfff97272373d4000"),
  BigInt("0xfff2e50f5f657000"),
  BigInt("0xffe5caca7e10f000"),
  BigInt("0xffcb9843d60f7000"),
  BigInt("0xff973b41fa98e800"),
  BigInt("0xff2ea16466c9b000"),
  BigInt("0xfe5dee046a9a3800"),
  BigInt("0xfcbe86c7900bb000"),
  BigInt("0xf987a7253ac65800"),
  BigInt("0xf3392b0822bb6000"),
  BigInt("0xe7159475a2caf000"),
  BigInt("0xd097f3bdfd2f2000"),
  BigInt("0xa9f746462d9f8000"),
  BigInt("0x70d869a156f31c00"),
  BigInt("0x31be135f97ed3200"),
];

function get_sqrt_price_at_tick(tick: number): bigint {
  const absTick = Math.abs(tick);
  let ratio =
    (absTick & 0x1) !== 0 ? SQRT_PRICES_1[0] : BigInt(1) << BigInt(64);

  for (let i = 1; i < 16; i++) {
    if ((absTick & (1 << i)) !== 0) {
      ratio = (ratio * SQRT_PRICES_1[i]) >> BigInt(64);
    }
  }

  if (tick > 0) {
    ratio = (BigInt("340282366920938463463374607431768211455") << BigInt(0)) / ratio;
  }

  return ratio;
}

function get_tick_at_sqrt_price(sqrtPriceX64: bigint): number {
  if (sqrtPriceX64 <= MIN_SQRT_PRICE_X64) return MIN_TICK;
  if (sqrtPriceX64 >= MAX_SQRT_PRICE_X64) return MAX_TICK;

  const msb = 128 - Number(sqrtPriceX64.toString(2).length);
  const log2pIntegerX32 = BigInt(msb - 64) << BigInt(32);

  let r =
    msb >= 64
      ? sqrtPriceX64 >> BigInt(msb - 63)
      : sqrtPriceX64 << BigInt(63 - msb);

  let bit = BigInt("0x8000000000000000");
  let precision = 0;
  let log2pFractionX64 = BigInt(0);

  while (bit > BigInt(0) && precision < 16) {
    r = r * r;
    const isRTwo = Number(r >> BigInt(127));
    r = r >> BigInt(63 + isRTwo);
    log2pFractionX64 += bit * BigInt(isRTwo);
    r = r;
    bit = bit >> BigInt(1);
    precision++;
  }

  const log2pFractionX32 = log2pFractionX64 >> BigInt(32);
  const log2pX32 = log2pIntegerX32 + log2pFractionX32;

  const logSqrt10001X64 = log2pX32 * BigInt("59543866431248");

  const tickLow = Number(
    (logSqrt10001X64 - BigInt("184467440737095516")) >> BigInt(64)
  );

  const tickHigh = Number(
    (logSqrt10001X64 + BigInt("15793534762490258745")) >> BigInt(64)
  );

  if (tickLow === tickHigh) return tickLow;
  if (get_sqrt_price_at_tick(tickHigh) <= sqrtPriceX64) return tickHigh;
  return tickLow;
}

function div_floor(a: bigint, b: bigint): bigint {
  if (a >= BigInt(0)) return a / b;
  return -((-a + b - BigInt(1)) / b);
}

function div_rounding_up(a: bigint, b: bigint): bigint {
  return a / b + (a % b > BigInt(0) ? BigInt(1) : BigInt(0));
}

function mul_div_floor(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b) / denom;
}

function mul_div_ceil(a: bigint, b: bigint, denom: bigint): bigint {
  return (a * b + denom - BigInt(1)) / denom;
}

function get_delta_amount_0_unsigned(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  const numerator1 = liquidity << BigInt(64);
  const numerator2 = sqrtB - sqrtA;
  if (roundUp) {
    const temp = mul_div_ceil(numerator1, numerator2, sqrtB);
    return div_rounding_up(temp, sqrtA);
  }
  return mul_div_floor(numerator1, numerator2, sqrtB) / sqrtA;
}

function get_delta_amount_1_unsigned(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA];
  const diff = sqrtB - sqrtA;
  if (roundUp) {
    return mul_div_ceil(liquidity, diff, Q64);
  }
  return mul_div_floor(liquidity, diff, Q64);
}

function get_next_sqrt_price_from_amount_0_rounding_up(
  sqrtPriceX64: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (amount === BigInt(0)) return sqrtPriceX64;
  const numerator1 = liquidity << BigInt(64);
  if (add) {
    const product = amount * sqrtPriceX64;
    if (product / sqrtPriceX64 === amount) {
      const denominator = numerator1 + product;
      if (denominator >= numerator1) {
        return mul_div_ceil(numerator1, sqrtPriceX64, denominator);
      }
    }
    const denom = numerator1 / sqrtPriceX64 + amount;
    return div_rounding_up(numerator1, denom);
  }
  const product = amount * sqrtPriceX64;
  const denominator = numerator1 - product;
  return mul_div_ceil(numerator1, sqrtPriceX64, denominator);
}

function get_next_sqrt_price_from_amount_1_rounding_down(
  sqrtPriceX64: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean
): bigint {
  if (add) {
    const quotient = (amount << BigInt(64)) / liquidity;
    return sqrtPriceX64 + quotient;
  }
  const quotient = div_rounding_up(amount << BigInt(64), liquidity);
  return sqrtPriceX64 - quotient;
}

function get_next_sqrt_price_from_input(
  sqrtPriceX64: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean
): bigint {
  if (zeroForOne) {
    return get_next_sqrt_price_from_amount_0_rounding_up(
      sqrtPriceX64,
      liquidity,
      amountIn,
      true
    );
  }
  return get_next_sqrt_price_from_amount_1_rounding_down(
    sqrtPriceX64,
    liquidity,
    amountIn,
    true
  );
}

interface SwapStep {
  sqrtPriceNextX64: bigint;
  amountIn: bigint;
  amountOut: bigint;
}

function compute_swap_step(
  sqrtPriceCurrentX64: bigint,
  sqrtPriceTargetX64: bigint,
  liquidity: bigint,
  amountRemaining: bigint,
  isBaseInput: boolean,
  zeroForOne: boolean
): SwapStep {
  const result: SwapStep = {
    sqrtPriceNextX64: sqrtPriceCurrentX64,
    amountIn: BigInt(0),
    amountOut: BigInt(0),
  };

  if (isBaseInput) {
    let amountIn = BigInt(0);
    let computeSuccess = true;
    try {
      if (zeroForOne) {
        amountIn = get_delta_amount_0_unsigned(
          sqrtPriceTargetX64,
          sqrtPriceCurrentX64,
          liquidity,
          true
        );
      } else {
        amountIn = get_delta_amount_1_unsigned(
          sqrtPriceCurrentX64,
          sqrtPriceTargetX64,
          liquidity,
          true
        );
      }
    } catch {
      computeSuccess = false;
    }

    if (computeSuccess) {
      result.amountIn = amountIn;
      result.sqrtPriceNextX64 =
        amountRemaining >= amountIn
          ? sqrtPriceTargetX64
          : get_next_sqrt_price_from_input(
              sqrtPriceCurrentX64,
              liquidity,
              amountRemaining,
              zeroForOne
            );
    } else {
      result.sqrtPriceNextX64 = get_next_sqrt_price_from_input(
        sqrtPriceCurrentX64,
        liquidity,
        amountRemaining,
        zeroForOne
      );
    }
  } else {
    let amountOut = BigInt(0);
    let computeSuccess = true;
    try {
      if (zeroForOne) {
        amountOut = get_delta_amount_1_unsigned(
          sqrtPriceTargetX64,
          sqrtPriceCurrentX64,
          liquidity,
          false
        );
      } else {
        amountOut = get_delta_amount_0_unsigned(
          sqrtPriceCurrentX64,
          sqrtPriceTargetX64,
          liquidity,
          false
        );
      }
    } catch {
      computeSuccess = false;
    }

    if (computeSuccess) {
      result.amountOut = amountOut;
      result.sqrtPriceNextX64 =
        amountRemaining >= amountOut
          ? sqrtPriceTargetX64
          : get_next_sqrt_price_from_input(
              sqrtPriceCurrentX64,
              liquidity,
              amountRemaining,
              zeroForOne
            );
    } else {
      result.sqrtPriceNextX64 = get_next_sqrt_price_from_input(
        sqrtPriceCurrentX64,
        liquidity,
        amountRemaining,
        zeroForOne
      );
    }
  }

  const max = sqrtPriceTargetX64 === result.sqrtPriceNextX64;

  if (zeroForOne) {
    if (!(max && isBaseInput)) {
      result.amountIn = get_delta_amount_0_unsigned(
        result.sqrtPriceNextX64,
        sqrtPriceCurrentX64,
        liquidity,
        true
      );
    }
    if (!(max && !isBaseInput)) {
      result.amountOut = get_delta_amount_1_unsigned(
        result.sqrtPriceNextX64,
        sqrtPriceCurrentX64,
        liquidity,
        false
      );
    }
  } else {
    if (!(max && isBaseInput)) {
      result.amountIn = get_delta_amount_1_unsigned(
        sqrtPriceCurrentX64,
        result.sqrtPriceNextX64,
        liquidity,
        true
      );
    }
    if (!(max && !isBaseInput)) {
      result.amountOut = get_delta_amount_0_unsigned(
        sqrtPriceCurrentX64,
        result.sqrtPriceNextX64,
        liquidity,
        false
      );
    }
  }

  if (!isBaseInput && result.amountOut > amountRemaining) {
    result.amountOut = amountRemaining;
  }

  return result;
}

function get_next_initialized_tick(
  currentTick: number,
  tickSpacing: number,
  zeroForOne: boolean,
  ticks: TickData[]
): TickData | null {
  const ticksInArray = TICKS_PER_ARRAY;
  let startTickIndex = Math.floor(currentTick / ticksInArray) * ticksInArray;
  if (currentTick < 0 && currentTick % ticksInArray !== 0) {
    startTickIndex -= ticksInArray;
  }

  const offset = Math.floor((currentTick - startTickIndex) / tickSpacing);

  if (zeroForOne) {
    const candidates = ticks.filter(
      (t) =>
        t.tickIndex < currentTick &&
        t.tickIndex >= startTickIndex &&
        (t.tickIndex - startTickIndex) / tickSpacing < offset
    );
    candidates.sort((a, b) => b.tickIndex - a.tickIndex);
    return candidates.length > 0 ? candidates[0] : null;
  } else {
    const candidates = ticks.filter(
      (t) =>
        t.tickIndex > currentTick &&
        t.tickIndex >= startTickIndex &&
        t.tickIndex < startTickIndex + ticksInArray * tickSpacing
    );
    candidates.sort((a, b) => a.tickIndex - b.tickIndex);
    return candidates.length > 0 ? candidates[0] : null;
  }
}

export function useSwapCalculate() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const program = useProgram();

  const [poolData, setPoolData] = useState<PoolData | null>(null);
  const [allTicks, setAllTicks] = useState<TickData[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTicks, setLoadingTicks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [tickArrays, setTickArrays] = useState<TickArrayData[]>([]);

  const fetchPool = useCallback(
    async (poolAddress: string) => {
      setLoading(true);
      setError(null);
      setPoolData(null);
      setAllTicks([]);
      setTickArrays([]);
      setFetched(false);

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

        const poolPk = new PublicKey(poolAddress.trim());
        const poolAccountInfo = await connection.getAccountInfo(poolPk);
        if (!poolAccountInfo) {
          throw new Error(
            "Pool account not found. Make sure the address is correct."
          );
        }

        const accounts = await program.account.poolState.all();
        const poolAcc = accounts.find(
          (acc) => acc.publicKey.toBase58() === poolAddress.trim()
        );
        if (!poolAcc) {
          throw new Error("Pool account not found on-chain.");
        }

        const s = poolAcc.account;

        const mint0Info = await getMint(connection, s.tokenMint0);
        const mint1Info = await getMint(connection, s.tokenMint1);

        const vaultAmount0 = await connection
          .getTokenAccountBalance(s.tokenVault0)
          .then((r) => r.value.amount)
          .catch(() => "0");
        const vaultAmount1 = await connection
          .getTokenAccountBalance(s.tokenVault1)
          .then((r) => r.value.amount)
          .catch(() => "0");

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
          price:
            Number(s.sqrtPriceX64.toString()) /
            Math.pow(2, 64),
          tokenDecimals0: mint0Info.decimals,
          tokenDecimals1: mint1Info.decimals,
          vaultAmount0,
          vaultAmount1,
        };

        setPoolData(data);
        setFetched(true);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || "Failed to fetch pool");
      } finally {
        setLoading(false);
      }
    },
    [connection]
  );

  const fetchTicks = useCallback(
    async (poolAddress: string) => {
      setLoadingTicks(true);
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
        const accounts = await program.account.tickArrayState.all();

        const filtered = accounts
          .filter(
            (acc) => acc.account.poolId.toBase58() === poolAddress.trim()
          )
          .map((acc) => {
            const ticks: TickData[] = [];
            const rawTicks = acc.account.ticks as any[];
            for (const t of rawTicks) {
              const tickIdx =
                typeof t.tick === "number" ? t.tick : Number(t.tick);
              const gross = t.liquidityGross?.toString() ?? "0";
              if (BigInt(gross) > BigInt(0)) {
                ticks.push({
                  tickIndex: tickIdx,
                  liquidityNet: t.liquidityNet?.toString() ?? "0",
                  liquidityGross: gross,
                  price: Math.pow(1.0001, tickIdx),
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
      } catch (err: any) {
        console.error("Failed to fetch tick arrays:", err);
        setError(err?.message || "Failed to fetch tick arrays");
      } finally {
        setLoadingTicks(false);
      }
    },
    [connection]
  );

  const simulateSwap = useCallback(
    (
      amountInHuman: string,
      inputToken: 0 | 1,
      pool: PoolData,
      ticks: TickData[]
    ): SwapResult | null => {
      const amountIn = parseFloat(amountInHuman);
      if (isNaN(amountIn) || amountIn <= 0) return null;
      if (ticks.length === 0) {
        return {
          amountIn: amountInHuman,
          amountOut: "0",
          executionPrice: 0,
          priceImpact: 100,
          ticksCrossed: 0,
          tickCrossDetails: [],
          finalSqrtPrice: Number(pool.sqrtPriceX64.toString()) / 2 ** 64,
          finalPrice: pool.price,
          finalTick: pool.currentTick,
          poolFeeNote: "No liquidity in pool",
          capped: false,
          maxAvailable: "0",
        };
      }

      const decimals =
        inputToken === 0 ? pool.tokenDecimals0 : pool.tokenDecimals1;
      const vaultRaw =
        inputToken === 0 ? pool.vaultAmount0 : pool.vaultAmount1;
      const maxAvailableHuman =
        Number(vaultRaw) / Math.pow(10, decimals);
      const capped = amountIn > maxAvailableHuman && maxAvailableHuman > 0;
      const effectiveAmount = capped ? maxAvailableHuman : amountIn;
      const effectiveAmountStr = capped
        ? maxAvailableHuman < 0.000001 && maxAvailableHuman > 0
          ? maxAvailableHuman.toExponential(6)
          : String(maxAvailableHuman)
        : amountInHuman;

      const amountInRaw = BigInt(
        Math.round(effectiveAmount * Math.pow(10, decimals)).toString()
      );

      const zeroForOne = inputToken === 0;

      let sqrtPriceX64: bigint;
      try {
        sqrtPriceX64 = BigInt(pool.sqrtPriceX64.toString());
      } catch {
        return null;
      }

      let liquidity: bigint;
      try {
        liquidity = BigInt(pool.liquidity.toString());
      } catch {
        liquidity = BigInt(0);
      }

      let currentTick = pool.currentTick;

      const sqrtPriceLimitX64 = zeroForOne
        ? MIN_SQRT_PRICE_X64 + BigInt(1)
        : MAX_SQRT_PRICE_X64 - BigInt(1);

      let amountSpecifiedRemaining = amountInRaw;
      let amountCalculated = BigInt(0);

      const sortedTicks = zeroForOne
        ? [...ticks].sort((a, b) => b.tickIndex - a.tickIndex)
        : [...ticks].sort((a, b) => a.tickIndex - b.tickIndex);

      const tickCrossDetails: Array<{
        tick: number;
        liquidityBefore: string;
        liquidityAfter: string;
      }> = [];

      let iterations = 0;
      const MAX_ITERATIONS = 200;

      while (
        amountSpecifiedRemaining > BigInt(0) &&
        sqrtPriceX64 !== sqrtPriceLimitX64 &&
        iterations < MAX_ITERATIONS
      ) {
        iterations++;
        const sqrtPriceStartX64 = sqrtPriceX64;

        const nextTick = get_next_initialized_tick(
          currentTick,
          pool.tickSpacing,
          zeroForOne,
          sortedTicks
        );

        let tickNext: number;
        let initialized: boolean;
        let sqrtPriceNextX64: bigint;

        if (nextTick) {
          tickNext = nextTick.tickIndex;
          initialized = true;
        } else {
          tickNext = zeroForOne ? MIN_TICK : MAX_TICK;
          initialized = false;
        }

        if (tickNext < MIN_TICK) tickNext = MIN_TICK;
        if (tickNext > MAX_TICK) tickNext = MAX_TICK;

        try {
          sqrtPriceNextX64 = get_sqrt_price_at_tick(tickNext);
        } catch {
          break;
        }

        const targetPrice =
          (zeroForOne &&
            sqrtPriceNextX64 < sqrtPriceLimitX64) ||
          (!zeroForOne && sqrtPriceNextX64 > sqrtPriceLimitX64)
            ? sqrtPriceLimitX64
            : sqrtPriceNextX64;

        let swapStep: SwapStep;
        try {
          swapStep = compute_swap_step(
            sqrtPriceStartX64,
            targetPrice,
            liquidity,
            amountSpecifiedRemaining,
            true,
            zeroForOne
          );
        } catch {
          break;
        }

        sqrtPriceX64 = swapStep.sqrtPriceNextX64;

        amountSpecifiedRemaining =
          amountSpecifiedRemaining - swapStep.amountIn;
        amountCalculated = amountCalculated + swapStep.amountOut;

        if (amountSpecifiedRemaining < BigInt(0)) {
          amountSpecifiedRemaining = BigInt(0);
        }

        if (
          sqrtPriceX64 === sqrtPriceNextX64 &&
          initialized &&
          nextTick
        ) {
          const liqBefore = liquidity.toString();
          let liquidityNet = BigInt(nextTick.liquidityNet);
          if (zeroForOne) {
            liquidityNet = -liquidityNet;
          }
          liquidity = liquidity + liquidityNet;

          tickCrossDetails.push({
            tick: tickNext,
            liquidityBefore: liqBefore,
            liquidityAfter: liquidity.toString(),
          });

          currentTick = zeroForOne ? tickNext - 1 : tickNext;
        } else if (sqrtPriceX64 !== sqrtPriceStartX64) {
          try {
            currentTick = get_tick_at_sqrt_price(sqrtPriceX64);
          } catch {
            break;
          }
        }
      }

      const finalSqrtPrice =
        Number(sqrtPriceX64.toString()) / 2 ** 64;
      const finalPrice = finalSqrtPrice * finalSqrtPrice;

      const amountInDecimal =
        Number(amountInRaw.toString()) / Math.pow(10, decimals);

      const outDecimals =
        inputToken === 0 ? pool.tokenDecimals1 : pool.tokenDecimals0;
      const amountOutDecimal =
        Number(amountCalculated.toString()) / Math.pow(10, outDecimals);

      const executionPrice =
        amountInDecimal > 0 ? amountOutDecimal / amountInDecimal : 0;

      const sqrtF =
        Number(pool.sqrtPriceX64.toString()) / 2 ** 64;
      const spotPrice = sqrtF * sqrtF;

      const spotPriceForDirection =
        inputToken === 0 ? spotPrice : 1 / spotPrice;
      const execPriceForDirection =
        inputToken === 0 ? executionPrice : executionPrice;

      const priceImpact =
        spotPriceForDirection > 0
          ? Math.abs(
              ((execPriceForDirection - spotPriceForDirection) /
                spotPriceForDirection) *
                100
            )
          : 0;

      return {
        amountIn: capped ? effectiveAmountStr : amountInHuman,
        amountOut:
          amountOutDecimal < 0.000001 && amountOutDecimal > 0
            ? amountOutDecimal.toExponential(6)
            : amountOutDecimal.toFixed(6),
        executionPrice:
          executionPrice < 0.000001 && executionPrice > 0
            ? executionPrice.toExponential(6)
            : executionPrice,
        priceImpact: Math.min(priceImpact, 100),
        ticksCrossed: tickCrossDetails.length,
        tickCrossDetails,
        finalSqrtPrice,
        finalPrice,
        finalTick: currentTick,
        poolFeeNote:
          "This pool has no on-chain fee in the swap instruction.",
        capped,
        maxAvailable: capped ? effectiveAmountStr : "0",
      };
    },
    []
  );

  const [swapTx, setSwapTx] = useState<SwapTxState>({
    isSubmitting: false,
    error: null,
    txSignature: null,
  });

  const executeSwap = useCallback(
    async (
      pool: PoolData,
      inputToken: 0 | 1,
      amountInHuman: string
    ): Promise<string | null> => {
      if (!program || !wallet) {
        setSwapTx((s) => ({
          ...s,
          error: "Connect your wallet first",
        }));
        return null;
      }

      const amountParsed = parseFloat(amountInHuman);
      if (isNaN(amountParsed) || amountParsed <= 0) {
        setSwapTx((s) => ({ ...s, error: "Enter a valid amount" }));
        return null;
      }

      setSwapTx({ isSubmitting: true, error: null, txSignature: null });

      try {
        const poolPk = new PublicKey(pool.address);
        const tokenMint0 = new PublicKey(pool.tokenMint0);
        const tokenMint1 = new PublicKey(pool.tokenMint1);

        const inputMint = inputToken === 0 ? tokenMint0 : tokenMint1;
        const outputMint = inputToken === 0 ? tokenMint1 : tokenMint0;
        const inputDecimals =
          inputToken === 0 ? pool.tokenDecimals0 : pool.tokenDecimals1;

        const amountInRaw = BigInt(
          Math.round(amountParsed * Math.pow(10, inputDecimals)).toString()
        );

        const [inputVaultPda] = findTokenVaultPda(poolPk, inputMint);
        const [outputVaultPda] = findTokenVaultPda(poolPk, outputMint);

        const userInputAta = getAssociatedTokenAddressSync(
          inputMint,
          wallet.publicKey
        );
        const userOutputAta = getAssociatedTokenAddressSync(
          outputMint,
          wallet.publicKey
        );

        const ticksPerArray = 60 * pool.tickSpacing;
        const tickArrayStartIdx =
          Math.floor(pool.currentTick / ticksPerArray) * ticksPerArray;
        const [tickArrayPda] = findTickArrayPda(poolPk, tickArrayStartIdx);

        const instructions = [];

        const inputAtaInfo = await connection.getAccountInfo(userInputAta);
        if (!inputAtaInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              userInputAta,
              wallet.publicKey,
              inputMint
            )
          );
        }

        const outputAtaInfo = await connection.getAccountInfo(userOutputAta);
        if (!outputAtaInfo) {
          instructions.push(
            createAssociatedTokenAccountInstruction(
              wallet.publicKey,
              userOutputAta,
              wallet.publicKey,
              outputMint
            )
          );
        }

        const ix = await program.methods
          .swap(
            new BN(amountInRaw.toString()),
            new BN(0),
            new BN(0),
            true
          )
          .accounts({
            payer: wallet.publicKey,
            poolState: poolPk,
            inputTokenAccount: userInputAta,
            outputTokenAccount: userOutputAta,
            inputVault: inputVaultPda,
            outputVault: outputVaultPda,
            tickArray: tickArrayPda,
            tokenProgram: TOKEN_PROGRAM_ID,
          } as any)
          .instruction();

        instructions.push(ix);

        const tx = new Transaction();
        for (const i of instructions) tx.add(i);
        tx.feePayer = wallet.publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;

        const signedTx = await wallet.signTransaction(tx);
        const txSig = await connection.sendRawTransaction(
          signedTx.serialize()
        );
        await connection.confirmTransaction(txSig, "confirmed");

        setSwapTx({ isSubmitting: false, error: null, txSignature: txSig });
        return txSig;
      } catch (err: any) {
        console.error("Swap error:", err);
        const msg =
          err?.message || err?.logs?.join("\n") || "Transaction failed";
        setSwapTx({ isSubmitting: false, error: msg, txSignature: null });
        return null;
      }
    },
    [program, wallet, connection]
  );

  return {
    poolData,
    allTicks,
    tickArrays,
    loading,
    loadingTicks,
    error,
    fetched,
    fetchPool,
    fetchTicks,
    simulateSwap,
    executeSwap,
    swapTx,
    walletConnected: !!wallet,
  };
}
