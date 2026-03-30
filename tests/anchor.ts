import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, getAccount, getAssociatedTokenAddress, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ClmmBasic } from "../target/types/Clmm_Basic";
import { BN } from "@coral-xyz/anchor";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ClmmBasic as anchor.Program<ClmmBasic>;

  // Token A and Token B
  const tokenA_mint_address = new web3.PublicKey("7ccTwPumA3yhJF4aEWpPXCxo9oGUS8hW65XyLVnT2WGt");
  const tokenB_mint_address = new web3.PublicKey("AwacwrTPpKgFEYdFSqFTVSm9Q4HDuz5LeZk69NpwLeH6");


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
    const priceLower = 10;
    const priceUpper = 20;
    const priceInitial = 15;

    const TICK_ARRAY_SIZE = 60;
    const tickSpacing = 1; // FIX: matches hardcoded tick_spacing=1 in create_pool

    const raw_tick_lower = Math.log(priceLower) / Math.log(1.0001);
    const raw_tick_upper = Math.log(priceUpper) / Math.log(1.0001);

    // FIX: snap to tickSpacing=1 (just round, no *64 grouping)
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
});