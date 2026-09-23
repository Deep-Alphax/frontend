import {
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
// Explícito: o navegador não tem `Buffer` global, e o web3.js v1 o exige.
import { Buffer } from "buffer";

/*
 * Transferência de USDC (SPL) montada à mão — evita puxar o `@solana/spl-token`
 * inteiro para uma instrução só. Tudo aqui é puro (sem RPC): o blockhash vem do
 * backend e quem assina e transmite é a carteira.
 */

/** Programa SPL Token clássico (o USDC da Circle vive nele, não no Token-2022). */
export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
);

/** Índice da instrução `TransferChecked` no programa SPL Token. */
const TRANSFER_CHECKED = 12;

/** Conta de token associada (ATA) de `owner` para `mint`. */
export function associatedTokenAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  )[0];
}

/**
 * `TransferChecked` (confere mint e casas no programa — valor com casas
 * erradas falha on-chain em vez de mandar 1000× mais) + a `reference` do
 * Solana Pay como conta só-leitura, que é o que liga a transação à cobrança.
 */
export function transferCheckedInstruction(p: {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
  reference: PublicKey;
}): TransactionInstruction {
  // u64: `setBigUint64` truncaria em silêncio um valor maior.
  if (p.amount <= BigInt(0) || p.amount >= BigInt(2) ** BigInt(64)) {
    throw new Error("Amount out of range");
  }
  const data = new Uint8Array(10);
  const view = new DataView(data.buffer);
  data[0] = TRANSFER_CHECKED;
  view.setBigUint64(1, p.amount, true);
  data[9] = p.decimals;

  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: p.source, isSigner: false, isWritable: true },
      { pubkey: p.mint, isSigner: false, isWritable: false },
      { pubkey: p.destination, isSigner: false, isWritable: true },
      { pubkey: p.owner, isSigner: true, isWritable: false },
      { pubkey: p.reference, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

/** Transação pronta para a carteira assinar e transmitir. */
export function buildUsdcTransfer(p: {
  payer: PublicKey;
  receiver: string;
  mint: string;
  reference: string;
  amount: bigint;
  decimals: number;
  blockhash: string;
  lastValidBlockHeight: number;
}): Transaction {
  const mint = new PublicKey(p.mint);
  const tx = new Transaction({
    feePayer: p.payer,
    blockhash: p.blockhash,
    lastValidBlockHeight: p.lastValidBlockHeight,
  });
  tx.add(
    transferCheckedInstruction({
      source: associatedTokenAddress(p.payer, mint),
      mint,
      destination: associatedTokenAddress(new PublicKey(p.receiver), mint),
      owner: p.payer,
      amount: p.amount,
      decimals: p.decimals,
      reference: new PublicKey(p.reference),
    }),
  );
  return tx;
}
