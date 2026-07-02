import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, getAccount, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ClmmBasic } from "../target/types/Clmm_Basic";
import { BN } from "@coral-xyz/anchor";

describe("Test", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ClmmBasic as anchor.Program<ClmmBasic>;

  // Token A and Token B
  const tokenA_mint_address = new web3.PublicKey("2yUWpgR1cX453hmxnh7RJEspfoBt2JVzWyUKniXzVheY");
  const tokenB_mint_address = new web3.PublicKey("3fKqu7JLynEkyooG6TvBmq4djU6jsHuPivTcLgpKfhQQ");


  const [pool_state_pda, bump] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_seed"), tokenA_mint_address.toBuffer(), tokenB_mint_address.toBuffer()],
    program.programId
  );

  const pool_state_pda_publicKey = new web3.PublicKey(pool_state_pda);

  const [token_vault_0_pda, bump2] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenA_mint_address.toBuffer()],
    program.programId
  );

  const [token_vault_1_pda, bump3] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenB_mint_address.toBuffer()],
    program.programId
  );

  it("creates a liquidity pool of token A and token B", async () => {

    const sqrt_price_x64 = new BN(2).pow(new BN(64));

    // Send Transaction
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

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);

    // Confirm Transaction
    await program.provider.connection.confirmTransaction(txHash);
  });



  it("opens a position", async () => {
    const priceLower = 0.8;
    const priceUpper = 1.2;
    const priceInitial = 1;

    const TICK_ARRAY_SIZE = 60;
    const tickSpacing = 1;

    const raw_tick_lower = Math.log(priceLower) / Math.log(1.0001);
    const raw_tick_upper = Math.log(priceUpper) / Math.log(1.0001);

    const tick_lower_index = Math.floor(raw_tick_lower / tickSpacing) * tickSpacing;
    const tick_upper_index = Math.floor(raw_tick_upper / tickSpacing) * tickSpacing;

    console.log("tick_lower_index:", tick_lower_index); // ~23025
    console.log("tick_upper_index:", tick_upper_index); // ~30010

    // ticks_per_array = 60 * 1 = 60
    const ticks_per_array = TICK_ARRAY_SIZE * tickSpacing;

    const tick_array_lower_start_index =
      Math.floor(tick_lower_index / ticks_per_array) * ticks_per_array;

    const tick_array_upper_start_index =
      Math.floor(tick_upper_index / ticks_per_array) * ticks_per_array;

    console.log("tick_array_lower_start_index:", tick_array_lower_start_index);
    console.log("tick_array_upper_start_index:", tick_array_upper_start_index);

    const sqrtPLower = Math.sqrt(priceLower);
    const sqrtPUpper = Math.sqrt(priceUpper);
    const sqrtPCurrent = Math.sqrt(priceInitial);

    const desiredTokenA = 100 * (10 ** 9);

    const liquidity = Math.floor(
      desiredTokenA * (sqrtPUpper * sqrtPCurrent) / (sqrtPUpper - sqrtPCurrent)
    );

    const liquidityValue = new BN(liquidity.toString());

    const expectedTokenBToSubmit = liquidity * (sqrtPCurrent - sqrtPLower);
    console.log("To Submit TokenB:", expectedTokenBToSubmit / 10 ** 9);

    const amount0Max = new BN(500_000_000_000);
    const amount1Max = new BN(10000_000_000_000);

    // BE matches Rust's to_be_bytes()
    const lowerIndexBuffer = Buffer.alloc(4);
    lowerIndexBuffer.writeInt32BE(tick_array_lower_start_index);

    const upperIndexBuffer = Buffer.alloc(4);
    upperIndexBuffer.writeInt32BE(tick_array_upper_start_index);

    console.log("Lower Index Buffer (BE):", lowerIndexBuffer.toString("hex"));
    console.log("Upper Index Buffer (BE):", upperIndexBuffer.toString("hex"));

    const [tick_array_lower_account] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        pool_state_pda.toBuffer(),
        lowerIndexBuffer,
      ],
      program.programId
    );

    const [tick_array_upper_account] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        pool_state_pda.toBuffer(),
        upperIndexBuffer,
      ],
      program.programId
    );

    console.log("tick_array_lower_account:", tick_array_lower_account.toString());
    console.log("tick_array_upper_account:", tick_array_upper_account.toString());

    const token_account_0 = getAssociatedTokenAddressSync(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const token_account_1 = getAssociatedTokenAddressSync(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const txHash = await program.methods
      .openPosition(
        tick_lower_index,
        tick_upper_index,
        tick_array_lower_start_index,
        tick_array_upper_start_index,
        liquidityValue,
        amount0Max,
        amount1Max
      )
      .accounts({
        payer: program.provider.publicKey,
        poolState: pool_state_pda,
        tickArrayLower: tick_array_lower_account,
        tickArrayUpper: tick_array_upper_account,
        tokenAccount0: token_account_0,
        tokenAccount1: token_account_1,
        tokenVault0: token_vault_0_pda,
        tokenVault1: token_vault_1_pda,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);
  });


  it("fetches the pool_state, price ticks", async () => {

    const poolState = await program.account.poolState.fetch(pool_state_pda);
    console.log({
      sqrtPriceX64: poolState.sqrtPriceX64.toString(),
      liquidity: poolState.liquidity.toString(),
      tokenMint0: poolState.tokenMint0.toBase58(),
      tokenMint1: poolState.tokenMint1.toBase58(),
      tokenVault0: poolState.tokenVault0.toBase58(),
      tokenVault1: poolState.tokenVault1.toBase58(),
      openTime: poolState.openTime.toString(),
      tickSpacing: poolState.tickSpacing,
      currentTick: poolState.currentTick,
      bump: poolState.bump,
    });
  });


it("calculates the liquidity and the amount of tokens to be provided", async () => {
    const sqrtPLower = Math.sqrt(0.8);
    const sqrtPUpper = Math.sqrt(1.2);
    const sqrtPCurrent = Math.sqrt(1);

    const desiredTokenA = 100 * (10 ** 9);

    const liquidity = Math.floor(
      desiredTokenA * (sqrtPUpper * sqrtPCurrent) / (sqrtPUpper - sqrtPCurrent)
    );

    const liquidityValue = new BN(liquidity.toString());

    console.log("This is the liquidity that you are providing: ", liquidityValue.toString());

    const expectedTokenBToSubmit = liquidity * (sqrtPCurrent - sqrtPLower);
    
    console.log("These are the expected Token B to submit", expectedTokenBToSubmit / (10 ** 9));
  });

  it("recalculating liquidity by using Token B instead of Token A", async () => {
    const sqrtPLower = Math.sqrt(0.8);
    const sqrtPUpper = Math.sqrt(1.2);
    const sqrtPCurrent = Math.sqrt(1);

    const desiredTokenB = 121.16829434856346 * (10 ** 9); 

    const liquidity = Math.floor(
      desiredTokenB / (sqrtPCurrent - sqrtPLower)
    );

    const liquidityValue = new BN(liquidity.toString());
    console.log("This is the liquidity that you are providing: ", liquidityValue.toString());

    const expectedTokenAToSubmit = liquidity * ((sqrtPUpper - sqrtPCurrent) / (sqrtPUpper * sqrtPCurrent));
    console.log("These are the expected Token A to submit", expectedTokenAToSubmit / (10 ** 9)); 
  });



  it("adds/increases liquidity", async () => {

    const TICK_ARRAY_SIZE = 60;
    const tickSpacing = 1;

    const raw_tick_lower = Math.log(0.8) / Math.log(1.0001);
    const raw_tick_upper = Math.log(1.2) / Math.log(1.0001);

    const tick_lower_index = Math.floor(raw_tick_lower / tickSpacing) * tickSpacing;
    const tick_upper_index = Math.floor(raw_tick_upper / tickSpacing) * tickSpacing;

    const ticks_per_array = TICK_ARRAY_SIZE * tickSpacing;

    const tick_array_lower_start_index = Math.floor(tick_lower_index / ticks_per_array) * ticks_per_array;

    const tick_array_upper_start_index = Math.floor(tick_upper_index / ticks_per_array) * ticks_per_array;

    const lowerIndexBuffer = Buffer.alloc(4);
    lowerIndexBuffer.writeInt32BE(tick_array_lower_start_index);

    const upperIndexBuffer = Buffer.alloc(4);
    upperIndexBuffer.writeInt32BE(tick_array_upper_start_index);

    const [tick_array_lower_account] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        pool_state_pda.toBuffer(),
        lowerIndexBuffer,
      ],
      program.programId
    );

    const [tick_array_upper_account] = web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("tick_array"),
        pool_state_pda.toBuffer(),
        upperIndexBuffer,
      ],
      program.programId
    );


    const token_account_0 = getAssociatedTokenAddressSync(
      tokenA_mint_address,
      program.provider.publicKey
    );

    const token_account_1 = getAssociatedTokenAddressSync(
      tokenB_mint_address,
      program.provider.publicKey
    );

    const amount_0_max = new BN("101000000000"); 
    const amount_1_max = new BN("122000000000");
    const liquidityValueToSubmit = new BN("1147722557505");

    const txHash = await program.methods
    .increaseLiquidity(
      liquidityValueToSubmit,
      amount_0_max,
      amount_1_max,
      tick_lower_index,
      tick_upper_index,
    )
    .accounts({
      payer: program.provider.publicKey,
      poolState: pool_state_pda,
      tickArrayLower: tick_array_lower_account,
      tickArrayUpper: tick_array_upper_account,
      tokenAccount0: token_account_0,
      tokenAccount1: token_account_1,
      tokenVault0: token_vault_0_pda,
      tokenVault1: token_vault_1_pda,
      tokenProgram: TOKEN_PROGRAM_ID
    })
    .rpc();

    console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
    await program.provider.connection.confirmTransaction(txHash);
  });

    it("decrease liquidity", async() => {

    const TICK_ARRAY_SIZE = 60;
    const tickSpacing = 1;

    const raw_tick_lower = Math.log(0.8) / Math.log(1.0001);
    const raw_tick_upper = Math.log(1.2) / Math.log(1.0001);

    const tick_lower_index = Math.floor(raw_tick_lower / tickSpacing) * tickSpacing;
    const tick_upper_index = Math.floor(raw_tick_upper / tickSpacing) * tickSpacing;

    const ticks_per_array = TICK_ARRAY_SIZE * tickSpacing;

    const tick_array_lower_start_index = Math.floor(tick_lower_index / ticks_per_array) * ticks_per_array;
    const tick_array_upper_start_index = Math.floor(tick_upper_index / ticks_per_array) * ticks_per_array;

    const lowerIndexBuffer = Buffer.alloc(4);
    lowerIndexBuffer.writeInt32BE(tick_array_lower_start_index);

    const upperIndexBuffer = Buffer.alloc(4);
    upperIndexBuffer.writeInt32BE(tick_array_upper_start_index);

    const [tick_array_lower_account] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      pool_state_pda.toBuffer(),
      lowerIndexBuffer,
    ],
    program.programId
  );

    const [tick_array_upper_account] = web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      pool_state_pda.toBuffer(),
      upperIndexBuffer,
    ],
    program.programId
  );

  const recipient_Token_Account_0 = getAssociatedTokenAddressSync(
    tokenA_mint_address,
    program.provider.publicKey
  );

  const recipient_Token_Account_1 = getAssociatedTokenAddressSync(
    tokenB_mint_address,
    program.provider.publicKey
  );

  const amount_0_min = new BN("0");
  const amount_1_min = new BN("0");
  const liquidityValueToDecrease = new BN("1147722557505");

  const txHash = await program.methods
  .decreaseLiquidity(
    liquidityValueToDecrease,
    amount_0_min,
    amount_1_min,
    tick_lower_index,
    tick_upper_index
  )
  .accounts({
    poolState: pool_state_pda,
    tokenVault0: token_vault_0_pda,
    tokenVault1: token_vault_1_pda,
    tickArrayLower: tick_array_lower_account,
    tickArrayUpper: tick_array_upper_account,
    recipientTokenAccount0: recipient_Token_Account_0,
    recipientTokenAccount1: recipient_Token_Account_1,
    tokenProgram: TOKEN_PROGRAM_ID
  })
  .rpc();

  console.log(`Use 'solana confirm -v ${txHash}' to see the logs`);
  await program.provider.connection.confirmTransaction(txHash);
  });


  it("swaps token_1 for token_0", async () => {
    const tickSpacing = 1;
    const TICK_ARRAY_SIZE = 60;
    const ticks_per_array = TICK_ARRAY_SIZE * tickSpacing;

    // Position around current price (tick 0) so swap has active liquidity
    const tick_lower = -1;
    const tick_upper = 59;

    const tick_array_lower_start_index =
      Math.floor(tick_lower / ticks_per_array) * ticks_per_array; // -60
    const tick_array_upper_start_index =
      Math.floor(tick_upper / ticks_per_array) * ticks_per_array; // 0

    const bufLower = Buffer.alloc(4);
    bufLower.writeInt32BE(tick_array_lower_start_index);
    const bufUpper = Buffer.alloc(4);
    bufUpper.writeInt32BE(tick_array_upper_start_index);

    const [tick_array_lower_pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("tick_array"), pool_state_pda.toBuffer(), bufLower],
      program.programId
    );
    const [tick_array_upper_pda] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("tick_array"), pool_state_pda.toBuffer(), bufUpper],
      program.programId
    );

    const token_account_0 = getAssociatedTokenAddressSync(
      tokenA_mint_address,
      program.provider.publicKey
    );
    const token_account_1 = getAssociatedTokenAddressSync(
      tokenB_mint_address,
      program.provider.publicKey
    );

    // Provide liquidity at current price range so swap has active liquidity
    const sqrtPLower = Math.sqrt(Math.pow(1.0001, tick_lower));
    const sqrtPUpper = Math.sqrt(Math.pow(1.0001, tick_upper));
    const sqrtPCurrent = Math.sqrt(1);

    // Since tick_current (0) is within the range [-1, 59):
    // amount_0 = L * (√P_upper - √P_current) / (√P_upper * √P_current)
    // amount_1 = L * (√P_current - √P_lower)
    // We compute L from desired token_0 contribution
    const desiredTokenA = 3 * (10 ** 9); // 3 tokens of token A
    const liquidity = Math.floor(
      desiredTokenA * (sqrtPUpper * sqrtPCurrent) / (sqrtPUpper - sqrtPCurrent)
    );
    const liquidityValue = new BN(liquidity.toString());
    const amount0Max = new BN(100_000_000_000); // 100 tokens max
    const amount1Max = new BN(100_000_000_000); // 100 tokens max

    const txOpen = await program.methods
      .openPosition(
        tick_lower, tick_upper,
        tick_array_lower_start_index, tick_array_upper_start_index,
        liquidityValue, amount0Max, amount1Max
      )
      .accounts({
        payer: program.provider.publicKey,
        poolState: pool_state_pda,
        tickArrayLower: tick_array_lower_pda,
        tickArrayUpper: tick_array_upper_pda,
        tokenAccount0: token_account_0,
        tokenAccount1: token_account_1,
        tokenVault0: token_vault_0_pda,
        tokenVault1: token_vault_1_pda,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: web3.SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    console.log(`Use 'solana confirm -v ${txOpen}' to see the logs`);
    await program.provider.connection.confirmTransaction(txOpen);

    // Pool state should now have active liquidity
    const poolBefore = await program.account.poolState.fetch(pool_state_pda);
    console.log("Before swap:", {
      sqrtPriceX64: poolBefore.sqrtPriceX64.toString(),
      liquidity: poolBefore.liquidity.toString(),
      currentTick: poolBefore.currentTick,
    });

    // Swap token_1 for token_0 (zero_for_one = false, is_base_input = true)
    // Input: token_1, Output: token_0, Price moves UP
    const swapAmount = new BN(10_000_000); // 0.01 token B
    const otherAmountThreshold = new BN(0); // accept any output
    const sqrtPriceLimit = new BN(0); // no limit, use default boundaries

    const txSwap = await program.methods
      .swap(swapAmount, otherAmountThreshold, sqrtPriceLimit, false)
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

    console.log(`Use 'solana confirm -v ${txSwap}' to see the logs`);
    await program.provider.connection.confirmTransaction(txSwap);

    // Verify swap moved the price
    const poolAfter = await program.account.poolState.fetch(pool_state_pda);
    console.log("After swap:", {
      sqrtPriceX64: poolAfter.sqrtPriceX64.toString(),
      liquidity: poolAfter.liquidity.toString(),
      currentTick: poolAfter.currentTick,
    });

    // Price should have increased (more token_1 in, less token_0 out)
    const priceBefore = new BN(poolBefore.sqrtPriceX64);
    const priceAfter = new BN(poolAfter.sqrtPriceX64);
    console.log("Price change:", priceAfter.sub(priceBefore).toString());
  });
});