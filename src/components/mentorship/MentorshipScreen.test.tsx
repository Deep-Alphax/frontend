import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

// A aba de categoria vem de `?category=`. Cada teste define a query inicial.
let searchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => searchParams,
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
    categories: [
      {
        id: "c1",
        title: "Fundamentals",
        description: "Start here.",
        moduleIds: ["m1"],
      },
    ],
    modules: [
      {
        id: "m1",
        categoryId: "c1",
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
  searchParams = new URLSearchParams();
  window.history.replaceState(null, "", "/mentorship");
  getOverview.mockResolvedValue(overview());
});

/** Duas categorias: "Trading" (m2) vem ANTES de "Fundamentals" (m1). */
function twoCategories(): MentorshipOverview {
  const data = overview();
  data.modules.push({
    ...data.modules[0],
    id: "m2",
    categoryId: "c2",
    slug: "reading-a-token",
    title: "Reading a token",
    lessonCount: 4,
    completedCount: 0,
    lessons: [
      lesson({
        id: "l9",
        title: "Six numbers in four seconds",
        moduleId: "m2",
        moduleTitle: "Reading a token",
      }),
    ],
  });
  data.categories = [
    { id: "c2", title: "Trading", description: "", moduleIds: ["m2"] },
    ...data.categories,
  ];
  return data;
}

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

  it("'Continue where you left off' é um link para a página da aula", async () => {
    renderWithQuery(<MentorshipScreen />);

    const link = await screen.findByRole("link", {
      name: "Continue: Fee, gas and priority tip",
    });
    // Slug do MÓDULO dono da aula + id da aula (mesma rota das esteiras).
    expect(link).toHaveAttribute("href", "/mentorship/on-chain-fundamentals/l2");
  });

  it("abas: All + uma por categoria, na ordem do servidor, com nº de módulos", async () => {
    getOverview.mockResolvedValue(twoCategories());
    renderWithQuery(<MentorshipScreen />);

    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "All2",
      "Trading1",
      "Fundamentals1",
    ]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
  });

  it("All: cada categoria com cabeçalho e grade, SEM as esteiras de aulas", async () => {
    getOverview.mockResolvedValue(twoCategories());
    renderWithQuery(<MentorshipScreen />);

    const trading = await screen.findByRole("region", { name: "Trading" });
    const fundamentals = screen.getByRole("region", { name: "Fundamentals" });
    expect(trading).toHaveTextContent("Reading a token");
    expect(trading).not.toHaveTextContent("On-chain fundamentals");
    expect(fundamentals).toHaveTextContent("Start here.");
    // Progresso da categoria: 1 de 2 aulas = 50%.
    expect(
      within(fundamentals).getByRole("progressbar", { name: "Fundamentals progress" }),
    ).toHaveAttribute("aria-valuenow", "50");
    // Esteira (lista de aulas) só aparece dentro da aba da categoria.
    expect(screen.queryByText("Six numbers in four seconds")).not.toBeInTheDocument();
  });

  it("clicar na aba mostra SÓ aquela categoria, com as esteiras, e grava na URL", async () => {
    const user = userEvent.setup();
    getOverview.mockResolvedValue(twoCategories());
    renderWithQuery(<MentorshipScreen />);

    await user.click(await screen.findByRole("tab", { name: /Trading/ }));

    expect(screen.getByRole("tab", { name: /Trading/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Six numbers in four seconds");
    expect(panel).not.toHaveTextContent("On-chain fundamentals");
    expect(window.location.search).toBe("?category=trading");
  });

  it("abre direto na aba que está na URL; slug desconhecido cai em All", async () => {
    getOverview.mockResolvedValue(twoCategories());
    searchParams = new URLSearchParams("category=fundamentals");
    const { unmount } = renderWithQuery(<MentorshipScreen />);
    expect(
      await screen.findByRole("tab", { name: /Fundamentals/ }),
    ).toHaveAttribute("aria-selected", "true");
    unmount();

    searchParams = new URLSearchParams("category=renamed-long-ago");
    renderWithQuery(<MentorshipScreen />);
    expect(await screen.findByRole("tab", { name: /All/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("uma categoria só: sem abas, categoria direto com as esteiras", async () => {
    renderWithQuery(<MentorshipScreen />);

    await screen.findByRole("region", { name: "Fundamentals" });
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    // Esteira presente: o título da trilha aparece no card E no cabeçalho dela.
    expect(screen.getAllByText("On-chain fundamentals").length).toBeGreaterThan(1);
  });

  it("sem categorias na resposta (backend antigo), mostra a grade sem título", async () => {
    const data = overview();
    // Simula a resposta anterior à mudança: o campo nem existe.
    delete (data as Partial<MentorshipOverview>).categories;
    getOverview.mockResolvedValue(data);

    renderWithQuery(<MentorshipScreen />);

    await screen.findByText("Tracks and modules");
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getAllByText("On-chain fundamentals").length).toBeGreaterThan(
      1,
    );
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
