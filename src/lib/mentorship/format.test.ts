import { describe, it, expect } from "vitest";

import {
  accentFill,
  accentText,
  formatClock,
  formatCompleted,
  formatDurationShort,
  formatEpisode,
  formatRemaining,
  parseClock,
} from "./format";

describe("formatClock", () => {
  it("formata mm:ss com o segundo em dois dígitos", () => {
    expect(formatClock(860)).toBe("14:20");
    expect(formatClock(605)).toBe("10:05");
    expect(formatClock(59)).toBe("0:59");
  });

  it("passa a h:mm:ss a partir de uma hora", () => {
    expect(formatClock(3600)).toBe("1:00:00");
    expect(formatClock(3750)).toBe("1:02:30");
  });

  it("trata zero e negativo sem quebrar", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(-40)).toBe("0:00");
  });
});

describe("parseClock", () => {
  it("é o inverso de formatClock", () => {
    for (const seconds of [0, 59, 860, 3750]) {
      expect(parseClock(formatClock(seconds))).toBe(seconds);
    }
  });

  it("aceita segundos crus e h:mm:ss", () => {
    expect(parseClock("860")).toBe(860);
    expect(parseClock("1:02:30")).toBe(3750);
  });

  it("aceita mais de 59 no PRIMEIRO campo (90:00 = 90 minutos)", () => {
    expect(parseClock("90:00")).toBe(5400);
  });

  it("recusa entrada que não é duração — devolve null, não 0", () => {
    // Um 0 silencioso viraria "aula sem duração" e mataria a barra de progresso.
    expect(parseClock("abc")).toBeNull();
    expect(parseClock("14:xx")).toBeNull();
    expect(parseClock("1:2:3:4")).toBeNull();
    expect(parseClock("10:75")).toBeNull();
    expect(parseClock("")).toBeNull();
  });
});

describe("formatDurationShort", () => {
  it("mantém minutos até 2h — é o '75min' que o Figma escreve na faixa", () => {
    expect(formatDurationShort(4500)).toBe("75min");
    expect(formatDurationShort(7140)).toBe("119min");
    expect(formatDurationShort(0)).toBe("0min");
  });

  it("passa a horas a partir de 120 minutos", () => {
    expect(formatDurationShort(7200)).toBe("2h");
    expect(formatDurationShort(9000)).toBe("2h 30min");
  });
});

describe("formatRemaining", () => {
  it("arredonda para CIMA — 40s restantes não são '0min'", () => {
    expect(formatRemaining(40)).toBe("1min left");
    expect(formatRemaining(360)).toBe("6min left");
  });

  it("diz 'done' quando não falta nada", () => {
    expect(formatRemaining(0)).toBe("done");
    expect(formatRemaining(-10)).toBe("done");
  });

  it("passa a horas quando faz sentido", () => {
    expect(formatRemaining(7200)).toBe("2h left");
    expect(formatRemaining(5400)).toBe("1h 30min left");
  });
});

describe("formatEpisode / formatCompleted", () => {
  it("preenche o episódio com dois dígitos", () => {
    expect(formatEpisode(4)).toBe("EP 04");
    expect(formatEpisode(12)).toBe("EP 12");
  });

  it("monta o contador da seção", () => {
    expect(formatCompleted(6, 23)).toBe("6 of 23 completed");
  });
});

describe("acento", () => {
  it("mapeia cada acento para classes ESTÁTICAS do Tailwind", () => {
    // Classe montada em runtime não é gerada no CSS — o mapa literal é o que
    // garante que `from-green-10` exista no bundle.
    expect(accentFill("GREEN")).toBe("from-green-10 to-green-12");
    expect(accentFill("AZUL")).toBe("from-azul-10 to-azul-12");
    expect(accentText("GREEN", 100)).toBe("text-green-11");
  });

  it("cai em cinza a 0% — cor de progresso sugere avanço onde não há", () => {
    expect(accentText("VIOLETA", 0)).toBe("text-gray-11");
    expect(accentText("VIOLETA", 1)).toBe("text-violeta-11");
  });

  it("cai no acento da marca se vier um valor desconhecido do backend", () => {
    // @ts-expect-error — simula enum novo no backend antes de o front subir.
    expect(accentFill("LARANJA")).toBe("from-principal-10 to-principal-12");
  });
});
