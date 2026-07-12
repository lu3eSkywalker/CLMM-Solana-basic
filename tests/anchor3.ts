import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ClmmBasic } from "../target/types/Clmm_Basic";
import { BN } from "@coral-xyz/anchor";

function getSqrtPriceAtTick(tick: number): BN {
  const absTick = Math.abs(tick);
  const Q64 = new BN(1).shln(64);

  let ratio: BN;
  if ((absTick & 1) !== 0) {
    ratio = new BN("fffcb933bd6fb800", 16);
  } else {
    ratio = new BN(Q64);
  }

  if ((absTick & 2) !== 0) ratio = ratio.mul(new BN("fff97272373d4000", 16)).shrn(64);
  if ((absTick & 4) !== 0) ratio = ratio.mul(new BN("fff2e50f5f657000", 16)).shrn(64);
  if ((absTick & 8) !== 0) ratio = ratio.mul(new BN("ffe5caca7e10f000", 16)).shrn(64);
  if ((absTick & 16) !== 0) ratio = ratio.mul(new BN("ffcb9843d60f7000", 16)).shrn(64);
  if ((absTick & 32) !== 0) ratio = ratio.mul(new BN("ff973b41fa98e800", 16)).shrn(64);
  if ((absTick & 64) !== 0) ratio = ratio.mul(new BN("ff2ea16466c9b000", 16)).shrn(64);
  if ((absTick & 128) !== 0) ratio = ratio.mul(new BN("fe5dee046a9a3800", 16)).shrn(64);
  if ((absTick & 256) !== 0) ratio = ratio.mul(new BN("fcbe86c7900bb000", 16)).shrn(64);
  if ((absTick & 512) !== 0) ratio = ratio.mul(new BN("f987a7253ac65800", 16)).shrn(64);
  if ((absTick & 1024) !== 0) ratio = ratio.mul(new BN("f3392b0822bb6000", 16)).shrn(64);
  if ((absTick & 2048) !== 0) ratio = ratio.mul(new BN("e7159475a2caf000", 16)).shrn(64);
  if ((absTick & 4096) !== 0) ratio = ratio.mul(new BN("d097f3bdfd2f2000", 16)).shrn(64);
  if ((absTick & 8192) !== 0) ratio = ratio.mul(new BN("a9f746462d9f8000", 16)).shrn(64);
  if ((absTick & 16384) !== 0) ratio = ratio.mul(new BN("70d869a156f31c00", 16)).shrn(64);
  if ((absTick & 32768) !== 0) ratio = ratio.mul(new BN("31be135f97ed3200", 16)).shrn(64);

  if (tick > 0) {
    const U128_MAX = new BN(1).shln(128).sub(new BN(1));
    ratio = U128_MAX.div(ratio);
  }

  return ratio;
}

describe("Test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ClmmBasic as anchor.Program<ClmmBasic>;

  const tokenA_mint_address = new web3.PublicKey("2yUWpgR1cX453hmxnh7RJEspfoBt2JVzWyUKniXzVheY");
  const tokenB_mint_address = new web3.PublicKey("3fKqu7JLynEkyooG6TvBmq4djU6jsHuPivTcLgpKfhQQ");

  const [pool_state_pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_seed"), tokenA_mint_address.toBuffer(), tokenB_mint_address.toBuffer()],
    program.programId
  );

  const pool_state_pda_publicKey = new web3.PublicKey(pool_state_pda);

  const [token_vault_0_pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [token_vault_1_pda] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenB_mint_address.toBuffer()],
    program.programId
  );

  const TICK_SPACING = 1;
  const TICK_ARRAY_SIZE = 60;
  const TICKS_PER_ARRAY = TICK_ARRAY_SIZE * TICK_SPACING;

  const POSITION_TICK_LOWER = -1;
  const POSITION_TICK_UPPER = 59;

  const TICK_ARRAY_LOWER_START =
    Math.floor(POSITION_TICK_LOWER / TICKS_PER_ARRAY) * TICKS_PER_ARRAY;
  const TICK_ARRAY_UPPER_START =
    Math.floor(POSITION_TICK_UPPER / TICKS_PER_ARRAY) * TICKS_PER_ARRAY;

  function getTickArrayPda(startIndex: number): web3.PublicKey {
    const buf = Buffer.alloc(4);
    buf.writeInt32BE(startIndex);
    const [pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("tick_array"), pool_state_pda.toBuffer(), buf],
      program.programId
    );
    return pda;
  }

  const tick_array_lower_pda = getTickArrayPda(TICK_ARRAY_LOWER_START);
  const tick_array_upper_pda = getTickArrayPda(TICK_ARRAY_UPPER_START);

  const token_account_0 = getAssociatedTokenAddressSync(
    tokenA_mint_address,
    program.provider.publicKey
  );
  const token_account_1 = getAssociatedTokenAddressSync(
    tokenB_mint_address,
    program.provider.publicKey
  );

  function sqrtPrice(tick: number): number {
    return Math.sqrt(Math.pow(1.0001, tick));
  }

  async function ensurePoolReady(): Promise<void> {
    const info = await program.provider.connection.getAccountInfo(pool_state_pda);
    if (!info) {
      const sqrt_price_x64 = new BN(2).pow(new BN(64));
      const txHash = await program.methods
        .createPool(sqrt_price_x64)
        .accounts({
          poolCreator: program.provider.publicKey,
          poolState: pool_state_pda,
          tokenMint0: tokenA_mint_address,
          tokenMint1: tokenB_mint_address,
          tokenVault0: token_vault_0_pda,
          tokenVault1: token_vault_1_pda,
          tokenProgram0: TOKEN_PROGRAM_ID,
          tokenProgram1: TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log(`Pool created. Use 'solana confirm -v ${txHash}' to see the logs`);
      await program.provider.connection.confirmTransaction(txHash);
      return;
    }

    const state = await program.account.poolState.fetch(pool_state_pda);
    if (state.currentTick === 0 && state.liquidity.eq(new BN(0))) {
      console.log("Pool exists and is clean (tick=0, liq=0) – skipping creation");
      return;
    }

    throw new Error(
      `Pool exists in stale state (tick=${state.currentTick}, liq=${state.liquidity}).\n` +
      `This test requires a fresh pool at tick=0 with liq=0.\n` +
      `To fix:\n` +
      `  1. Create new token mints (update mint addresses in the test), OR\n` +
      `  2. Close and recreate the pool:\n` +
      `       solana program close --bypass-warning ${program.programId}\n` +
      `     then re-deploy and re-run.`
    );
  }

  it("creates a liquidity pool of token A and token B", async () => {
    await ensurePoolReady();
  });


  // No base position — open multiple independent positions
  it("opens multiple independent positions at contiguous tick ranges", async () => {
    const ranges = [
      { lower: 0, upper: 19 },
      { lower: 19, upper: 35 },
      { lower: 35, upper: 59 },
    ];

    for (const range of ranges) {
      const liq = Math.floor(
        15 * (10 ** 9) * (sqrtPrice(range.upper) * sqrtPrice(range.lower))
          / (sqrtPrice(range.upper) - sqrtPrice(range.lower))
      );

      const tickArrayLowerStart = Math.floor(range.lower / TICKS_PER_ARRAY) * TICKS_PER_ARRAY;
      const tickArrayUpperStart = Math.floor(range.upper / TICKS_PER_ARRAY) * TICKS_PER_ARRAY;
      const tickArrayLower = getTickArrayPda(tickArrayLowerStart);
      const tickArrayUpper = getTickArrayPda(tickArrayUpperStart);

      console.log(`Range [${range.lower}, ${range.upper}]: liq=${liq}`);

      const tx = await program.methods
        .openPosition(
          range.lower,
          range.upper,
          tickArrayLowerStart,
          tickArrayUpperStart,
          new BN(liq.toString()),
          new BN(500_000_000_000),
          new BN(10_000_000_000_000),
        )
        .accounts({
          payer: program.provider.publicKey,
          poolState: pool_state_pda,
          tickArrayLower: tickArrayLower,
          tickArrayUpper: tickArrayUpper,
          tokenAccount0: token_account_0,
          tokenAccount1: token_account_1,
          tokenVault0: token_vault_0_pda,
          tokenVault1: token_vault_1_pda,
          rent: web3.SYSVAR_RENT_PUBKEY,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`Use 'solana confirm -v ${tx}' to see the logs`);
      await program.provider.connection.confirmTransaction(tx);
    }
  });

  it("increases liquidity", async () => {
    const extraLiquidity = new BN(10_000_000_000_000);
    const txHash = await program.methods
      .increaseLiquidity(
        extraLiquidity,
        new BN(500_000_000_000),
        new BN(10_000_000_000_000),
        0,
        19
      )
      .accounts({
        payer: program.provider.publicKey,
        poolState: pool_state_pda,
        tickArrayLower: tick_array_upper_pda,
        tickArrayUpper: tick_array_upper_pda,
        tokenAccount0: token_account_0,
        tokenAccount1: token_account_1,
        tokenVault0: token_vault_0_pda,
        tokenVault1: token_vault_1_pda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("decreases liquidity (back to original)", async () => {
    const extraLiquidity = new BN(10_000_000_000_000);
    const txHash = await program.methods
      .decreaseLiquidity(
        extraLiquidity,
        new BN(0),
        new BN(0),
        0,
        19
      )
      .accounts({
        poolState: pool_state_pda,
        tokenVault0: token_vault_0_pda,
        tokenVault1: token_vault_1_pda,
        tickArrayLower: tick_array_upper_pda,
        tickArrayUpper: tick_array_upper_pda,
        recipientTokenAccount0: token_account_0,
        recipientTokenAccount1: token_account_1,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);
  });

  it("swaps token_1 (B) for token_0 (A) staying in range", async () => {
    const swapAmount = new BN(10_000_000);

    const poolBefore = await program.account.poolState.fetch(pool_state_pda);
    console.log("Before swap:", {
      sqrtPriceX64: poolBefore.sqrtPriceX64.toString(),
      liquidity: poolBefore.liquidity.toString(),
      currentTick: poolBefore.currentTick,
    });

    const txHash = await program.methods
      .swap(swapAmount, new BN(0), new BN(0), true)
      .accounts({
        payer: program.provider.publicKey,
        poolState: pool_state_pda,
        inputTokenAccount: token_account_1,
        outputTokenAccount: token_account_0,
        inputVault: token_vault_1_pda,
        outputVault: token_vault_0_pda,
        tickArray: tick_array_upper_pda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);

    const poolAfter = await program.account.poolState.fetch(pool_state_pda);
    console.log("After swap:", {
      sqrtPriceX64: poolAfter.sqrtPriceX64.toString(),
      liquidity: poolAfter.liquidity.toString(),
      currentTick: poolAfter.currentTick,
    });
  });

  it("swaps token_1 (B) for token_0 (A) hopping across multiple ticks", async () => {
    const poolBefore = await program.account.poolState.fetch(pool_state_pda);

    const sqrtPriceLimit = getSqrtPriceAtTick(POSITION_TICK_UPPER);
    const swapAmount = new BN(300_000_000_000);

    console.log("Multi-tick swap - Before:", {
      sqrtPriceX64: poolBefore.sqrtPriceX64.toString(),
      liquidity: poolBefore.liquidity.toString(),
      currentTick: poolBefore.currentTick,
      sqrtPriceLimit: sqrtPriceLimit.toString(),
      swapAmount: swapAmount.toString(),
    });

    const txHash = await program.methods
      .swap(swapAmount, new BN(0), sqrtPriceLimit, true)
      .accounts({
        payer: program.provider.publicKey,
        poolState: pool_state_pda,
        inputTokenAccount: token_account_1,
        outputTokenAccount: token_account_0,
        inputVault: token_vault_1_pda,
        outputVault: token_vault_0_pda,
        tickArray: tick_array_upper_pda,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);

    const poolAfter = await program.account.poolState.fetch(pool_state_pda);
    console.log("Multi-tick swap - After:", {
      sqrtPriceX64: poolAfter.sqrtPriceX64.toString(),
      liquidity: poolAfter.liquidity.toString(),
      currentTick: poolAfter.currentTick,
    });

    console.log(
      `Tick crossed upper 59: ${poolAfter.currentTick >= POSITION_TICK_UPPER}`,
      `Liquidity removed: ${poolAfter.liquidity.eq(new BN(0))}`
    );
  });
});
