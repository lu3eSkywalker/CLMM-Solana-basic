import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { CpiGuardLayout, getAccount, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ClmmBasic } from "../target/types/Clmm_Basic";
import { BN } from "bn.js";

describe("Test", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.ClmmBasic as anchor.Program<ClmmBasic>;

  // Token A and Token B
  const tokenA_mint_address = new web3.PublicKey("7ccTwPumA3yhJF4aEWpPXCxo9oGUS8hW65XyLVnT2WGt");
  const tokenB_mint_address = new web3.PublicKey("AwacwrTPpKgFEYdFSqFTVSm9Q4HDuz5LeZk69NpwLeH6");

  it("creates a liquidity pool of token A and token B", async () => {

    const sqrt_price_x64 = new BN(2).pow(new BN(64));

    const [pool_state_pda, bump] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool_seed"), tokenA_mint_address.toBuffer(), tokenB_mint_address.toBuffer()],
      program.programId
    );

    const pool_state_pda_publicKey = new web3.PublicKey(pool_state_pda);

    const [token_vault_0_pda, bump2] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenA_mint_address.toBuffer()],
      program.programId
    );

    const [token_vault_1_pda, bump3] = await web3.PublicKey.findProgramAddressSync(
      [Buffer.from("pool_vault"), pool_state_pda_publicKey.toBuffer(), tokenB_mint_address.toBuffer()],
      program.programId
    );

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
  const tickLowerIndex = -10;
  const tickUpperIndex = 10;
  const tickSpacing = 1;
  const liquidity = new BN(1000000);
  const amount0Max = new BN(1000000);
  const amount1Max = new BN(1000000);

  // Derive tick array start indices (must be multiples of TICK_ARRAY_SIZE * tick_spacing)
  // TICK_ARRAY_SIZE is typically 60 in Raydium CLMM
  const TICK_ARRAY_SIZE = 60;
  const tickArrayLowerStartIndex =
    Math.floor(tickLowerIndex / (TICK_ARRAY_SIZE * tickSpacing)) *
    (TICK_ARRAY_SIZE * tickSpacing);
  const tickArrayUpperStartIndex =
    Math.floor(tickUpperIndex / (TICK_ARRAY_SIZE * tickSpacing)) *
    (TICK_ARRAY_SIZE * tickSpacing);

  // Derive pool state PDA (same as before)
  const [pool_state_pda] = await web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_seed"),
      tokenA_mint_address.toBuffer(),
      tokenB_mint_address.toBuffer(),
    ],
    program.programId
  );

  // Derive tick array PDAs
  // Note: to_be_bytes() on i32 = 4 bytes big-endian
  const lowerStartIndexBuffer = Buffer.alloc(4);
  lowerStartIndexBuffer.writeInt32BE(tickArrayLowerStartIndex, 0);

  const upperStartIndexBuffer = Buffer.alloc(4);
  upperStartIndexBuffer.writeInt32BE(tickArrayUpperStartIndex, 0);

  const [tick_array_lower_pda] = await web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      pool_state_pda.toBuffer(),
      lowerStartIndexBuffer,
    ],
    program.programId
  );

  const [tick_array_upper_pda] = await web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("tick_array"),
      pool_state_pda.toBuffer(),
      upperStartIndexBuffer,
    ],
    program.programId
  );

  // Token accounts for the payer (must already exist and hold tokens)
  // These should have been created in a beforeAll/before step
  const payerTokenAccount0 = await getAssociatedTokenAddress(
    tokenA_mint_address,
    program.provider.publicKey
  );
  const payerTokenAccount1 = await getAssociatedTokenAddress(
    tokenB_mint_address,
    program.provider.publicKey
  );

  // Derive vault PDAs (same as in createPool)
  const [token_vault_0_pda] = await web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      pool_state_pda.toBuffer(),
      tokenA_mint_address.toBuffer(),
    ],
    program.programId
  );

  const [token_vault_1_pda] = await web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("pool_vault"),
      pool_state_pda.toBuffer(),
      tokenB_mint_address.toBuffer(),
    ],
    program.programId
  );

  const txHash = await program.methods
    .openPosition(
      tickArrayLowerStartIndex,  // tick_array_lower_start_index
      tickArrayUpperStartIndex,  // tick_array_upper_start_index
      liquidity,                 // liquidity
      amount0Max,                // amount_0_max
      amount1Max,                // amount_1_max
      tickLowerIndex,            // tick_lower_index
      tickUpperIndex             // tick_upper_index
    )
    .accounts({
      payer: program.provider.publicKey,
      poolState: pool_state_pda,
      tickArrayLower: tick_array_lower_pda,
      tickArrayUpper: tick_array_upper_pda,
      tokenAccount0: payerTokenAccount0,
      tokenAccount1: payerTokenAccount1,
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