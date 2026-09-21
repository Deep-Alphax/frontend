import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { renderWithQuery } from "@/test/queryWrapper";
import { MentorshipScreen } from "./MentorshipScreen";
import * as api from "@/lib/api/mentorship";
import type { MentorshipOverview } from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  // Só a chamada de rede é dublada; as chaves de query e os tipos continuam
  // vindo do módulo real, senão o teste passaria com uma chave inventada.
  const actual = await importOriginal<typeof api>();
  return { ...actual, getMentorshipOverview: vi.fn() };
});

// `Topbar`/`Footer` puxam sessão e navegação — fora do que esta tela decide.
vi.mock("@/components/home/Topbar", () => ({ Topbar: () => <header /> }));
vi.mock("@/components/home/Footer", () => ({ Footer: () => <footer /> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));

function lesson(
  over: Partial<api.MentorshipLesson> = {},
): api.MentorshipLesson {
  return {
    id: "l1",
    title: "How a Solana transaction really happens",
    description: "From the click to the confirmed block.",
    episode: 1,
    durationSec: 860,
    coverUrl: "/mentorship/lesson-internet.webp",
    videoUrl: "",
    moduleId: "m1",
    moduleTitle: "On-chain fundamentals",
    positionSec: 0,
    completed: false,
    percent: 0,
    materials: [],
    ...over,
  };
}

function overview(over: Partial<MentorshipOverview> = {}): MentorshipOverview {
  return {
    modules: [
      {
        id: "m1",
        slug: "on-chain-fundamentals",
        title: "On-chain fundamentals",
        subtitle: "Wallet, RPC, fee, gas, tip and slippage.",
        label: "Module 1",
        coverUrl: "/mentorship/module-market.webp",
        accent: "GREEN",
        lessonCount: 2,
        totalDurationSec: 1600,
        completedCount: 1,
        percent: 50,
        lessons: [
          lesson({ id: "l1", completed: true, percent: 100 }),
          lesson({ id: "l2", title: "Fee, gas and priority tip", episode: 2 }),
        ],
      },
    ],
    totals: { modules: 1, lessons: 2, completed: 1 },
    continueLesson: {
      ...lesson({
        id: "l2",
        title: "Fee, gas and priority tip",
        episode: 2,
        percent: 36,
      }),
      remainingSec: 360,
    },
    ...over,
  };
}

const getOverview = vi.mocked(api.getMentorshipOverview);

beforeEach(() => {
  vi.clearAllMocks();
  getOverview.mockResolvedValue(overview());
});

describe("MentorshipScreen", () => {
  it("busca a visão geral UMA vez e monta as três seções", async () => {
    renderWithQuery(<MentorshipScreen />);

    expect(await screen.findByText("Tracks and modules")).toBeInTheDocument();
    expect(screen.getByText("Continue where you left off")).toBeInTheDocument();
    // O título da trilha aparece no card da grade E no cabeçalho da esteira.
    expect(screen.getAllByText("On-chain fundamentals").length).toBeGreaterThan(
      1,
    );

    // Uma chamada só: o progresso vem junto, não há um request por card.
    expect(getOverview).toHaveBeenCalledTimes(1);
  });

  it("mostra o contador de concluídas vindo do servidor", async () => {
    renderWithQuery(<MentorshipScreen />);
    expect(await screen.findByText("1 of 2 completed")).toBeInTheDocument();
  });

  it("mostra o progresso da trilha e o que falta da aula em andamento", async () => {
    renderWithQuery(<MentorshipScreen />);
    expect(await screen.findByText("50% complete")).toBeInTheDocument();
    expect(screen.getByText("36% · 6min left")).toBeInTheDocument();
  });

  it("marca 100% com o texto próprio da trilha concluída", async () => {
    const data = overview();
    data.modules[0].percent = 100;
    getOverview.mockResolvedValue(data);

    renderWithQuery(<MentorshipScreen />);
    expect(await screen.findByText("100% track complete")).toBeInTheDocument();
  });

  it("omite o card de continuar quando não há aula pendente", async () => {
    getOverview.mockResolvedValue(overview({ continueLesson: null }));

    renderWithQuery(<MentorshipScreen />);
    await screen.findByText("Tracks and modules");
    expect(
      screen.queryByText("Continue where you left off"),
    ).not.toBeInTheDocument();
  });

  it("avisa em vez de ficar em branco quando a API falha", async () => {
    getOverview.mockRejectedValue(new Error("boom"));

    renderWithQuery(<MentorshipScreen />);
    await waitFor(() =>
      expect(
        screen.getByText(/could not load the mentorship content/i),
      ).toBeInTheDocument(),
    );
  });

  it("mostra o estado vazio quando nenhuma trilha está publicada", async () => {
    getOverview.mockResolvedValue(
      overview({
        modules: [],
        totals: { modules: 0, lessons: 0, completed: 0 },
        continueLesson: null,
      }),
    );

    renderWithQuery(<MentorshipScreen />);
    expect(
      await screen.findByText(/no tracks published yet/i),
    ).toBeInTheDocument();
  });
});
