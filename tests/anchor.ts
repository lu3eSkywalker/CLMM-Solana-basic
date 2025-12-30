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
});