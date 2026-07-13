import { PublicKey } from "@solana/web3.js";

const POOL_SEED = "pool_seed";
const POOL_VAULT_SEED = "pool_vault";
const TICK_ARRAY_SEED = "tick_array";

export const PROGRAM_ID = new PublicKey(
  "8wTERW3SPDTkoPvvBgzcpKouA4YrVWbEmqVp9vDwxZTG"
);

export function findPoolStatePda(
  tokenMint0: PublicKey,
  tokenMint1: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(POOL_SEED),
      tokenMint0.toBuffer(),
      tokenMint1.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function findTokenVaultPda(
  poolState: PublicKey,
  tokenMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(POOL_VAULT_SEED),
      poolState.toBuffer(),
      tokenMint.toBuffer(),
    ],
    PROGRAM_ID
  );
}

export function findTickArrayPda(
  poolState: PublicKey,
  startIndex: number
): [PublicKey, number] {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(startIndex);
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(TICK_ARRAY_SEED),
      poolState.toBuffer(),
      buf,
    ],
    PROGRAM_ID
  );
}

export function sortTokenMints(
  mintA: PublicKey,
  mintB: PublicKey
): { mint0: PublicKey; mint1: PublicKey; swapped: boolean } {
  if (mintA.toBuffer().compare(mintB.toBuffer()) < 0) {
    return { mint0: mintA, mint1: mintB, swapped: false };
  }
  return { mint0: mintB, mint1: mintA, swapped: true };
}
