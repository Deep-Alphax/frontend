import { afterEach, describe, expect, it, vi } from "vitest";

import { formatBps, formatCents, timeAgo } from "@/lib/api/affiliates";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("timeAgo", () => {
  afterEach(() => vi.useRealTimers());

  const freeze = () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  };

  it("escolhe a maior unidade que cabe (é o '5m ago' do design)", () => {
    freeze();
    expect(timeAgo(ago(5 * 60_000))).toBe("5m ago");
    expect(timeAgo(ago(3 * 3_600_000))).toBe("3h ago");
    expect(timeAgo(ago(2 * 86_400_000))).toBe("2d ago");
    expect(timeAgo(ago(70 * 86_400_000))).toBe("2mo ago");
    expect(timeAgo(ago(400 * 86_400_000))).toBe("1y ago");
  });

  it("diz 'just now' abaixo de um minuto, em vez de '0m ago'", () => {
    freeze();
    expect(timeAgo(ago(30_000))).toBe("just now");
  });

  it("mostra travessão quando o indicado nunca pagou", () => {
    expect(timeAgo(null)).toBe("—");
  });

  it("não inventa tempo negativo com relógio adiantado no servidor", () => {
    freeze();
    expect(timeAgo(new Date(NOW.getTime() + 60_000).toISOString())).toBe("—");
  });

  it("não quebra com data inválida", () => {
    freeze();
    expect(timeAgo("nao-e-uma-data")).toBe("—");
  });
});

describe("formatCents", () => {
  it("converte centavos inteiros em moeda", () => {
    expect(formatCents(5_000, "usd")).toBe("$50.00");
    expect(formatCents(0, "usd")).toBe("$0.00");
  });

  it("troca o símbolo pela moeda do backend, mantendo o formato en-US", () => {
    // O site é em inglês, então a separação continua "50.00" mesmo em BRL —
    // é o locale que manda no formato, e a moeda só no símbolo.
    expect(formatCents(5_000, "brl")).toBe("R$50.00");
  });
});

describe("formatBps", () => {
  it("mostra percentual redondo sem casas decimais", () => {
    expect(formatBps(2000)).toBe("20%");
    expect(formatBps(500)).toBe("5%");
    expect(formatBps(0)).toBe("0%");
  });

  it("mostra as casas quando o percentual é quebrado", () => {
    // 750bps = 7,5%: arredondar para "8%" mentiria sobre o contrato.
    expect(formatBps(750)).toBe("7.50%");
  });
});
