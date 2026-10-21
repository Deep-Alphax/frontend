import { describe, expect, it } from "vitest";

import {
  autoChain,
  chainCounts,
  chainsForAddress,
  filterWallets,
  walletChainOf,
  walletFormError,
} from "./chains";

const SOL = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const EVM = "0x" + "ab".repeat(20);

describe("rede da carteira", () => {
  it("redes possíveis pelo formato do endereço", () => {
    expect(chainsForAddress(SOL)).toEqual(["SOLANA"]);
    expect(chainsForAddress(EVM)).toEqual(["ETHEREUM", "BASE", "BSC", "ROBINHOOD"]);
    expect(chainsForAddress("")).toHaveLength(5);
  });

  it("pré-seleção: Solana sozinha; EVM obriga escolher", () => {
    expect(autoChain(SOL, null)).toBe("SOLANA");
    expect(autoChain(EVM, "SOLANA")).toBeNull();
    expect(autoChain(EVM, "BASE")).toBe("BASE");
  });

  it("erro do formulário", () => {
    expect(walletFormError("", null)).toBeNull();
    expect(walletFormError("abc", "SOLANA")).toMatch(/valid/);
    expect(walletFormError(EVM, null)).toMatch(/Choose/);
    expect(walletFormError(EVM, "SOLANA")).toMatch(/EVM/);
    expect(walletFormError(SOL, "BASE")).toMatch(/Solana address/);
    expect(walletFormError(EVM, "BSC")).toBeNull();
  });

  it("carteira antiga: Solana inferida, EVM desconhecida", () => {
    expect(walletChainOf({ address: SOL })).toBe("SOLANA");
    expect(walletChainOf({ address: EVM })).toBeNull();
    expect(walletChainOf({ address: EVM, chain: "BASE" })).toBe("BASE");
  });

  it("filtro e contagem por rede", () => {
    const ws = [
      { address: SOL },
      { address: EVM, chain: "BASE" as const },
      { address: "0x" + "cd".repeat(20) },
    ];
    expect(filterWallets(ws, "SOLANA")).toHaveLength(1);
    expect(filterWallets(ws, "unknown")).toHaveLength(1);
    expect(filterWallets(ws, "all")).toHaveLength(3);
    expect(chainCounts(ws)).toEqual([
      { id: "SOLANA", count: 1 },
      { id: "BASE", count: 1 },
      { id: "unknown", count: 1 },
    ]);
  });
});
