import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { renderWithQuery } from "@/test/queryWrapper";
import { ModuleDetailScreen } from "./ModuleDetailScreen";
import * as api from "@/lib/api/mentorship";
import type { MentorshipOverview } from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  // Mesma dublagem da tela de mentoria: só a chamada de rede. A `queryKey` real
  // importa aqui — é ela que faz esta página reaproveitar o cache da outra.
  const actual = await importOriginal<typeof api>();
  return { ...actual, getMentorshipOverview: vi.fn() };
});

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

function overview(
  over: Partial<api.MentorshipModule> = {},
): MentorshipOverview {
  return {
    categories: [],
    modules: [
      {
        id: "m1",
        categoryId: "c1",
        slug: "on-chain-fundamentals",
        title: "On-chain fundamentals",
        subtitle: "Wallet, RPC, fee, gas, tip and slippage.",
        label: "Module 02",
        coverUrl: "/mentorship/module-market.webp",
        accent: "GREEN",
        lessonCount: 2,
        totalDurationSec: 4800,
        completedCount: 1,
        percent: 50,
        lessons: [
          lesson({ id: "l1", completed: true, percent: 100 }),
          lesson({ id: "l2", title: "Fee, gas and priority tip", episode: 2 }),
        ],
        ...over,
      },
    ],
    totals: { modules: 1, lessons: 2, completed: 1 },
    continueLesson: null,
  };
}

const getOverview = vi.mocked(api.getMentorshipOverview);

describe("ModuleDetailScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mostra capa, estatísticas e todos os episódios do módulo do slug", async () => {
    getOverview.mockResolvedValue(overview());
    renderWithQuery(<ModuleDetailScreen slug="on-chain-fundamentals" />);

    expect(
      await screen.findByRole("heading", { name: "On-chain fundamentals" }),
    ).toBeInTheDocument();

    // Rótulo + contagem no badge, e as duas estatísticas derivadas.
    expect(screen.getByText(/Module 02 ·\s*2 LESSONS/i)).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("80min")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();

    // As duas aulas do módulo aparecem na grade.
    expect(
      screen.getByText("How a Solana transaction really happens"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fee, gas and priority tip")).toBeInTheDocument();
  });

  it("oferece continuar quando resta aula, e não quando o módulo fechou", async () => {
    getOverview.mockResolvedValue(overview());
    const { unmount } = renderWithQuery(
      <ModuleDetailScreen slug="on-chain-fundamentals" />,
    );

    const cta = await screen.findByRole("button", { name: /Continue module/i });
    expect(cta).toBeEnabled();
    unmount();

    // Todas concluídas: o CTA perde a função e diz isso, em vez de ficar clicável
    // sem destino.
    getOverview.mockResolvedValue(
      overview({
        completedCount: 2,
        percent: 100,
        lessons: [
          lesson({ id: "l1", completed: true, percent: 100 }),
          lesson({ id: "l2", completed: true, percent: 100, episode: 2 }),
        ],
      }),
    );
    renderWithQuery(<ModuleDetailScreen slug="on-chain-fundamentals" />);

    const done = await screen.findByRole("button", {
      name: /Module completed/i,
    });
    expect(done).toBeDisabled();
  });

  it("avisa quando o slug não existe, em vez de renderizar vazio", async () => {
    getOverview.mockResolvedValue(overview());
    renderWithQuery(<ModuleDetailScreen slug="slug-que-nao-existe" />);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Module not found" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("link", { name: "Back to mentorship" }),
    ).toHaveAttribute("href", "/mentorship");
  });
});
