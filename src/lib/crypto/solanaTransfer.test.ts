// @vitest-environment node
// (jsdom tem outro realm de Uint8Array, e o sha256 do web3.js recusa os bytes.)
import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";

import {
  associatedTokenAddress,
  buildUsdcTransfer,
  TOKEN_PROGRAM_ID,
  transferCheckedInstruction,
} from "./solanaTransfer";

/*
 * Vetores conferidos contra o `@solana/spl-token` 0.4 (getAssociatedTokenAddressSync
 * e createTransferCheckedInstruction) — a lib oficial que substituímos à mão.
 */
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const RECEIVER = "BLNe5umxS7QGZPxvYAq3Favrs4hdeS47nThytnfFoE4u";
const PAYER = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const RECEIVER_ATA = "B82tei9xb1WkSF151TPSVCDLn1jWPBzho9umeCHX7NkU";
const PAYER_ATA = "FGETo8T8wMcN2wCjav8VK6eh3dLk63evNDPxzLSJra8B";
const REFERENCE = new PublicKey("11111111111111111111111111111112");

describe("associatedTokenAddress", () => {
  it("bate com o spl-token oficial", () => {
    expect(associatedTokenAddress(new PublicKey(RECEIVER), USDC).toBase58()).toBe(
      RECEIVER_ATA,
    );
    expect(associatedTokenAddress(PAYER, USDC).toBase58()).toBe(PAYER_ATA);
  });
});

describe("transferCheckedInstruction", () => {
  const ix = transferCheckedInstruction({
    source: new PublicKey(PAYER_ATA),
    mint: USDC,
    destination: new PublicKey(RECEIVER_ATA),
    owner: PAYER,
    amount: BigInt(50_012_345),
    decimals: 6,
    reference: REFERENCE,
  });

  it("dados: índice 12 + u64 LE + casas (igual ao spl-token)", () => {
    expect(ix.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(Buffer.from(ix.data).toString("hex")).toBe("0cb920fb020000000006");
  });

  it("contas na ordem do programa, com a reference só-leitura no fim", () => {
    expect(
      ix.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]),
    ).toEqual([
      [PAYER_ATA, false, true],
      [USDC.toBase58(), false, false],
      [RECEIVER_ATA, false, true],
      [PAYER.toBase58(), true, false],
      [REFERENCE.toBase58(), false, false],
    ]);
  });

  it("valor zero ou negativo é recusado", () => {
    expect(() =>
      transferCheckedInstruction({
        source: PAYER,
        mint: USDC,
        destination: PAYER,
        owner: PAYER,
        amount: BigInt(0),
        decimals: 6,
        reference: REFERENCE,
      }),
    ).toThrow();
  });

  it("valor acima de 2^53 vai inteiro; acima de u64 é recusado (não trunca)", () => {
    const base = {
      source: PAYER,
      mint: USDC,
      destination: PAYER,
      owner: PAYER,
      decimals: 9,
      reference: REFERENCE,
    };
    const big = transferCheckedInstruction({ ...base, amount: BigInt("9007199254740993") });
    const view = new DataView(big.data.buffer, big.data.byteOffset, big.data.length);
    expect(view.getBigUint64(1, true)).toBe(BigInt("9007199254740993"));

    expect(() =>
      transferCheckedInstruction({ ...base, amount: BigInt(2) ** BigInt(64) }),
    ).toThrow();
  });
});

describe("buildUsdcTransfer", () => {
  it("monta a transação com fee payer, blockhash e a transferência — sem assinaturas", () => {
    const tx = buildUsdcTransfer({
      payer: PAYER,
      receiver: RECEIVER,
      mint: USDC.toBase58(),
      reference: REFERENCE.toBase58(),
      amount: BigInt(50_012_345),
      decimals: 6,
      blockhash: "EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k",
      lastValidBlockHeight: 123,
    });
    expect(tx.feePayer?.equals(PAYER)).toBe(true);
    expect(tx.recentBlockhash).toBe("EETubP5AKHgjPAhzPAFcb8BAY1hMH639CWCFTqi3hq1k");
    expect(tx.lastValidBlockHeight).toBe(123);
    expect(tx.instructions).toHaveLength(1);
    expect(tx.instructions[0].keys[0].pubkey.toBase58()).toBe(PAYER_ATA);
    expect(tx.instructions[0].keys[2].pubkey.toBase58()).toBe(RECEIVER_ATA);
    // Serializa sem assinatura: a carteira é quem assina.
    expect(() =>
      tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
    ).not.toThrow();
  });
});
