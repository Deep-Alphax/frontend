import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { MentorshipStats } from "./MentorshipStats";
import * as api from "@/lib/api/mentorship";
import type { MentorshipStats as Stats } from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, getMentorshipStats: vi.fn() };
});

const getStats = vi.mocked(api.getMentorshipStats);

function stats(over: Partial<Stats> = {}): Stats {
  return {
    totals: {
      learners: 12,
      lessonsStarted: 48,
      lessonsCompleted: 30,
      activeLast30d: 7,
    },
    modules: [
      {
        id: "m1",
        title: "On-chain fundamentals",
        label: "Module 01",
        published: true,
        lessonCount: 2,
        learners: 10,
        completions: 12,
        completionRate: 60,
        lessons: [
          {
            id: "l1",
            title: "How a transaction happens",
            episode: 1,
            published: true,
            started: 10,
            completed: 9,
            completionRate: 90,
          },
          {
            id: "l2",
            title: "Fee, gas and priority tip",
            episode: 2,
            published: false,
            started: 0,
            completed: 0,
            completionRate: 0,
          },
        ],
      },
    ],
    ...over,
  };
}

describe("MentorshipStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra os quatro números de manchete", async () => {
    getStats.mockResolvedValue(stats());
    renderWithQuery(<MentorshipStats />);

    expect(await screen.findByText("Learners")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("48")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("resume o módulo e expõe a taxa como medida acessível", async () => {
    getStats.mockResolvedValue(stats());
    renderWithQuery(<MentorshipStats />);

    expect(
      await screen.findByText("On-chain fundamentals"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/10 learners · 2 lessons · 12 completed/),
    ).toBeInTheDocument();
    // A barra não é decoração: quem usa leitor de tela recebe o mesmo número.
    expect(
      screen.getByRole("img", { name: "60% completed" }),
    ).toBeInTheDocument();
  });

  it("abre a tabela de aulas e marca rascunho e aula sem audiência", async () => {
    const user = userEvent.setup();
    getStats.mockResolvedValue(stats());
    renderWithQuery(<MentorshipStats />);

    const toggle = await screen.findByRole("button", {
      name: /On-chain fundamentals/,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const table = screen.getByRole("table");
    expect(
      within(table).getByText(/How a transaction happens/),
    ).toBeInTheDocument();
    expect(within(table).getByText("90%")).toBeInTheDocument();
    // Sem ninguém tendo aberto, a taxa seria 0/0: mostramos travessão, não "0%".
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(within(table).getAllByText("draft").length).toBeGreaterThan(0);
  });

  it("estado vazio não finge número", async () => {
    getStats.mockResolvedValue(
      stats({
        totals: {
          learners: 0,
          lessonsStarted: 0,
          lessonsCompleted: 0,
          activeLast30d: 0,
        },
        modules: [],
      }),
    );
    renderWithQuery(<MentorshipStats />);

    expect(await screen.findByText("No tracks yet.")).toBeInTheDocument();
  });

  it("falha de rede vira mensagem, não tela quebrada", async () => {
    getStats.mockRejectedValue(new Error("boom"));
    renderWithQuery(<MentorshipStats />);

    expect(
      await screen.findByText(/Could not load the usage stats/),
    ).toBeInTheDocument();
  });
});
