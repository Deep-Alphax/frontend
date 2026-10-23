import { describe, expect, it } from "vitest";

import type { DepositView } from "@/lib/api/deposits";
import {
  addressError,
  amountError,
  amountPresets,
  defaultAssetFor,
  displayMinBrlCents,
  formatBrlInput,
  formatBrlShort,
  formatCountdown,
  formatEta,
  formatFee,
  formatTokenAmount,
  groupAssets,
  maxDepositBrlCents,
  parseBrlInput,
  pollInterval,
  safeExternalUrl,
  statusLabel,
  timelineSteps,
} from "./format";

const SOL_ADDR = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const EVM_ADDR = "0x52908400098527886E0F7030069857D2E4169EE7"; // checksum EIP-55 válido

describe("addressError", () => {
  it("Solana: aceita base58 de 32 bytes e recusa o resto", () => {
    expect(addressError("SOLANA", SOL_ADDR)).toBeNull();
    expect(addressError("SOLANA", `  ${SOL_ADDR}  `)).toBeNull();
    expect(addressError("SOLANA", "")).toBe("Enter the destination address.");
    expect(addressError("SOLANA", "abc")).toBe("Not a valid Solana address.");
    expect(addressError("SOLANA", "0OIl" + SOL_ADDR.slice(4))).toBe("Not a valid Solana address.");
    expect(addressError("SOLANA", EVM_ADDR)).toMatch(/EVM \(0x\) address/);
  });

  it("EVM: 0x + 40 hex, com checksum quando há maiúsculas", () => {
    expect(addressError("BASE", EVM_ADDR)).toBeNull();
    expect(addressError("ETHEREUM", EVM_ADDR.toLowerCase())).toBeNull();
    expect(addressError("BASE", EVM_ADDR.replace("E7", "e7"))).toMatch(/Checksum/);
    expect(addressError("BSC", "0x1234")).toBe("Not a valid BNB Chain address (0x + 40 hex characters).");
    expect(addressError("POLYGON", SOL_ADDR)).toMatch(/Solana address — Polygon needs a 0x/);
  });
});

describe("valor em reais", () => {
  it("parseBrlInput entende o formato brasileiro e o com ponto", () => {
    expect(parseBrlInput("600")).toBe(60_000);
    expect(parseBrlInput("1.000")).toBe(100_000);
    expect(parseBrlInput("1.000,50")).toBe(100_050);
    expect(parseBrlInput("R$ 2.500")).toBe(250_000);
    expect(parseBrlInput("1000.5")).toBe(100_050);
    expect(parseBrlInput("599,9")).toBe(59_990);
    expect(parseBrlInput("")).toBeNull();
    expect(parseBrlInput("abc")).toBeNull();
    expect(parseBrlInput("1,2,3")).toBeNull();
    expect(parseBrlInput("0")).toBeNull();
    expect(parseBrlInput("10,555")).toBeNull();
  });

  it("formatos curtos e de campo", () => {
    expect(formatBrlInput(100_000)).toBe("1.000");
    expect(formatBrlInput(100_050)).toBe("1.000,5");
    expect(formatBrlShort(60_000)).toBe("R$ 600");
    expect(formatBrlShort(250_000)).toBe("R$ 2.500");
    expect(formatBrlShort(51_837)).toBe("R$ 518,37");
    expect(displayMinBrlCents(51_837)).toBe(51_900);
  });

  it("teto = menor entre o limite e o que resta hoje", () => {
    expect(maxDepositBrlCents({ maxBrlCents: 500_000, dailyLeftBrlCents: 120_000 })).toBe(120_000);
    expect(maxDepositBrlCents({ maxBrlCents: 500_000, dailyLeftBrlCents: 900_000 })).toBe(500_000);
    expect(maxDepositBrlCents({ maxBrlCents: 500_000, dailyLeftBrlCents: -1 })).toBe(0);
  });

  it("atalhos só dentro do intervalo", () => {
    expect(amountPresets(52_000, 500_000)).toEqual([60_000, 100_000, 250_000]);
    expect(amountPresets(52_000, 120_000)).toEqual([60_000, 100_000]);
    expect(amountPresets(70_000, 500_000)).toEqual([100_000, 250_000]);
    expect(amountPresets(null, 500_000)).toEqual([60_000, 100_000, 250_000]);
  });

  it("amountError: mínimo arredondado e teto do dia", () => {
    expect(amountError(null, 51_837, 500_000, false)).toBe("Enter an amount in BRL.");
    expect(amountError(50_000, 51_837, 500_000, false)).toBe("Minimum is R$ 519.");
    expect(amountError(600_000, 51_837, 500_000, false)).toBe("Maximum is R$ 5.000.");
    expect(amountError(200_000, 51_837, 150_000, true)).toBe("Maximum is R$ 1.500 today.");
    expect(amountError(100_000, 51_837, 500_000, false)).toBeNull();
  });
});

describe("moedas e exibição", () => {
  const assets = [
    { chain: "SOLANA" as const, symbol: "SOL", name: "Solana", native: true },
    { chain: "SOLANA" as const, symbol: "USDC", name: "USD Coin", native: false },
    { chain: "BASE" as const, symbol: "USDC", name: "USD Coin", native: false },
    { chain: "BASE" as const, symbol: "ETH", name: "Ether", native: true },
  ];

  it("agrupa por rede na ordem do servidor e escolhe a nativa", () => {
    expect(groupAssets(assets).map((g) => [g.chain, g.assets.map((a) => a.symbol)])).toEqual([
      ["SOLANA", ["SOL", "USDC"]],
      ["BASE", ["USDC", "ETH"]],
    ]);
    expect(defaultAssetFor(assets)?.symbol).toBe("SOL");
    expect(defaultAssetFor(assets, "BASE")?.symbol).toBe("ETH");
    // Rede sem moeda: cai na padrão.
    expect(defaultAssetFor(assets, "POLYGON")?.symbol).toBe("SOL");
  });

  it("quantias, prazo, taxa e relógio", () => {
    expect(formatTokenAmount("0.421337", "SOL")).toBe("0.4213 SOL");
    expect(formatTokenAmount("12.345678", "ETH")).toBe("12.3457 ETH");
    expect(formatTokenAmount("184.1", "USDT")).toBe("184.10 USDT");
    expect(formatEta(180)).toBe("≈ 3 min");
    expect(formatEta(30)).toBe("under a minute");
    expect(formatFee(150)).toBe("1.5%");
    expect(formatFee(100)).toBe("1%");
    expect(formatCountdown(14 * 60_000 + 5_000)).toBe("14:05");
    expect(formatCountdown(-10)).toBe("0:00");
  });

  it("safeExternalUrl só deixa http(s)", () => {
    expect(safeExternalUrl("https://solscan.io/tx/abc")).toBe("https://solscan.io/tx/abc");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("status", () => {
  const base: Pick<
    DepositView,
    "status" | "chain" | "symbol" | "paidAt" | "txUrl" | "orderUrl" | "deliveredAmount"
  > = {
    status: "PAID",
    chain: "SOLANA",
    symbol: "SOL",
    paidAt: "2026-10-22T12:00:00Z",
    txUrl: null,
    orderUrl: null,
    deliveredAmount: null,
  };
  const states = (d: typeof base) => timelineSteps(d).map((s) => `${s.id}:${s.state}`);

  it("ritmo da consulta", () => {
    expect(pollInterval("PENDING")).toBe(3_000);
    expect(pollInterval("SENDING")).toBe(5_000);
    expect(pollInterval("SENT")).toBe(5_000);
    expect(pollInterval("DELIVERED")).toBe(false);
    expect(pollInterval("EXPIRED")).toBe(false);
    expect(pollInterval(undefined)).toBe(false);
  });

  it("Solana: sem etapa de ponte", () => {
    expect(states(base)).toEqual(["received:done", "sending:current", "delivered:upcoming"]);
    expect(
      states({ ...base, status: "DELIVERED", txUrl: "https://solscan.io/tx/1", deliveredAmount: "0.42" }),
    ).toEqual(["received:done", "sending:done", "delivered:done"]);
    const delivered = timelineSteps({
      ...base,
      status: "DELIVERED",
      txUrl: "https://solscan.io/tx/1",
      deliveredAmount: "0.42",
    });
    expect(delivered[1].link).toEqual({ href: "https://solscan.io/tx/1", label: "View transaction" });
    expect(delivered[2].label).toBe("Delivered · 0.42 SOL");
  });

  it("cross-chain: ponte com link de acompanhamento", () => {
    const evm = { ...base, chain: "BASE" as const, symbol: "ETH" };
    expect(states({ ...evm, status: "SENDING" })).toEqual([
      "received:done",
      "sending:current",
      "bridging:upcoming",
      "delivered:upcoming",
    ]);
    const sent = timelineSteps({
      ...evm,
      status: "SENT",
      txUrl: "https://solscan.io/tx/2",
      orderUrl: "https://app.debridge.finance/order?orderId=1",
    });
    expect(sent.map((s) => s.state)).toEqual(["done", "done", "current", "upcoming"]);
    expect(sent[2]).toMatchObject({
      label: "Bridging to Base",
      link: { label: "Track transfer", href: "https://app.debridge.finance/order?orderId=1" },
    });
  });

  it("FAILED marca a etapa em que parou", () => {
    expect(states({ ...base, status: "FAILED" })).toEqual([
      "received:done",
      "sending:failed",
      "delivered:upcoming",
    ]);
    expect(
      states({ ...base, chain: "ARBITRUM", status: "FAILED", orderUrl: "https://x.io/o" }),
    ).toEqual(["received:done", "sending:done", "bridging:failed", "delivered:upcoming"]);
  });

  it("rótulo do chip", () => {
    expect(statusLabel({ status: "PENDING", chain: "SOLANA" }).label).toBe("Awaiting Pix");
    expect(statusLabel({ status: "SENT", chain: "BASE" }).label).toBe("Bridging");
    expect(statusLabel({ status: "SENT", chain: "SOLANA" }).label).toBe("Sending");
    expect(statusLabel({ status: "FAILED", chain: "SOLANA" }).tone).toBe("danger");
  });
});
