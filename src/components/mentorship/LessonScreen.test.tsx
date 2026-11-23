import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { LessonScreen } from "./LessonScreen";
import * as api from "@/lib/api/mentorship";
import type { MentorshipOverview } from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getMentorshipOverview: vi.fn(),
    saveLessonProgress: vi.fn(),
  };
});

// API do player (script externo do YouTube) fica fora: tem teste próprio.
vi.mock("@/lib/mentorship/player", () => ({
  attachPlayer: vi.fn(() => new Promise(() => {})),
}));
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
    title: "RPC, latency and why you arrive late",
    description: "Public vs dedicated RPC, measured in milliseconds.",
    episode: 4,
    durationSec: 598,
    coverUrl: "",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    moduleId: "m1",
    moduleTitle: "On-chain fundamentals",
    positionSec: 0,
    completed: false,
    percent: 0,
    materials: [],
    ...over,
  };
}

/**
 * Dois módulos: o primeiro com duas aulas (a segunda é a que testamos), o
 * segundo controlado por `secondModulePercent` — é ele que decide se concluir
 * a última aula fecha só o MÓDULO ou o CURSO inteiro.
 */
function overview({
  firstLessonDone = true,
  secondModulePercent = 0,
  materials = [] as api.MentorshipMaterial[],
} = {}): MentorshipOverview {
  return {
    categories: [],
    modules: [
      {
        id: "m1",
        categoryId: "c1",
        slug: "on-chain-fundamentals",
        title: "On-chain fundamentals",
        subtitle: "",
        label: "Module 01",
        coverUrl: "",
        accent: "PRINCIPAL",
        lessonCount: 2,
        totalDurationSec: 1200,
        completedCount: firstLessonDone ? 1 : 0,
        percent: firstLessonDone ? 50 : 0,
        lessons: [
          lesson({
            id: "l0",
            title: "How a transaction happens",
            episode: 1,
            completed: firstLessonDone,
          }),
          lesson({ id: "l1", materials }),
        ],
      },
      {
        id: "m2",
        categoryId: "c1",
        slug: "reading-a-token",
        title: "Reading a token",
        subtitle: "",
        label: "Module 02",
        coverUrl: "",
        accent: "GREEN",
        lessonCount: 1,
        totalDurationSec: 600,
        completedCount: secondModulePercent === 100 ? 1 : 0,
        percent: secondModulePercent,
        lessons: [
          lesson({
            id: "l2",
            title: "Six numbers in four seconds",
            moduleId: "m2",
            moduleTitle: "Reading a token",
            episode: 1,
            completed: secondModulePercent === 100,
          }),
        ],
      },
    ],
    totals: { modules: 2, lessons: 3, completed: 0 },
    continueLesson: null,
  };
}

const getOverview = vi.mocked(api.getMentorshipOverview);
const saveProgress = vi.mocked(api.saveLessonProgress);

function renderLesson() {
  return renderWithQuery(
    <LessonScreen slug="on-chain-fundamentals" lessonId="l1" />,
  );
}

describe("LessonScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveProgress.mockResolvedValue({
      lessonId: "l1",
      positionSec: 0,
      completed: true,
      percent: 100,
    });
  });

  it("mostra a aula, o player embutido e o progresso do módulo", async () => {
    getOverview.mockResolvedValue(overview());
    renderLesson();

    expect(
      await screen.findByRole("heading", {
        name: "RPC, latency and why you arrive late",
      }),
    ).toBeInTheDocument();

    // O iframe usa o embed -nocookie derivado do `videoUrl`, não a URL crua,
    // com a API JS ligada (progresso real — ver LessonPlayer).
    const frame = screen.getByTitle("RPC, latency and why you arrive late");
    const src = new URL(frame.getAttribute("src")!);
    expect(`${src.origin}${src.pathname}`).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(src.searchParams.get("enablejsapi")).toBe("1");

    expect(
      screen.getByText("1 of 2 lessons in this module"),
    ).toBeInTheDocument();
  });

  it("sem vídeo linkado, avisa em vez de renderizar um frame vazio", async () => {
    const data = overview();
    data.modules[0].lessons[1].videoUrl = "";
    getOverview.mockResolvedValue(data);
    renderLesson();

    expect(await screen.findByText("Video coming soon")).toBeInTheDocument();
    expect(screen.queryByTitle(/RPC, latency/)).not.toBeInTheDocument();
  });

  it("lista os materiais com tamanho legível e link seguro", async () => {
    getOverview.mockResolvedValue(
      overview({
        materials: [
          {
            id: "mat1",
            title: "RPC guide.pdf",
            url: "https://cdn.example.com/rpc.pdf",
            kind: "PDF",
            sizeBytes: 2516582,
          },
        ],
      }),
    );
    renderLesson();

    const link = await screen.findByRole("link", { name: /RPC guide\.pdf/ });
    expect(link).toHaveAttribute("href", "https://cdn.example.com/rpc.pdf");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
  });

  it("marcar como concluída salva e, fechando o módulo, celebra o MÓDULO", async () => {
    const user = userEvent.setup();
    // Primeira aula já feita e segundo módulo pendente → fecha só o módulo.
    getOverview.mockResolvedValue(overview({ firstLessonDone: true }));
    renderLesson();

    await user.click(
      await screen.findByRole("button", { name: "Mark as completed" }),
    );

    expect(saveProgress).toHaveBeenCalledTimes(1);
    expect(saveProgress.mock.calls[0][0]).toBe("l1");
    expect(saveProgress.mock.calls[0][1]).toEqual({ completed: true });

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Module completed" }),
      ).toBeInTheDocument(),
    );
    // Havendo módulo seguinte, o CTA leva para ele.
    expect(screen.getByRole("link", { name: "Next module" })).toHaveAttribute(
      "href",
      "/mentorship/reading-a-token",
    );
  });

  it("quando era o último pendente do curso, celebra o CURSO", async () => {
    const user = userEvent.setup();
    getOverview.mockResolvedValue(
      overview({ firstLessonDone: true, secondModulePercent: 100 }),
    );
    renderLesson();

    await user.click(
      await screen.findByRole("button", { name: "Mark as completed" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Course completed" }),
      ).toBeInTheDocument(),
    );
  });

  it("não celebra quando ainda resta aula no módulo", async () => {
    const user = userEvent.setup();
    getOverview.mockResolvedValue(overview({ firstLessonDone: false }));
    renderLesson();

    await user.click(
      await screen.findByRole("button", { name: "Mark as completed" }),
    );

    await waitFor(() => expect(saveProgress).toHaveBeenCalled());
    expect(
      screen.queryByRole("heading", { name: /completed/i }),
    ).not.toBeInTheDocument();
  });

  it("aula já concluída não oferece o botão de novo", async () => {
    const data = overview();
    data.modules[0].lessons[1].completed = true;
    getOverview.mockResolvedValue(data);
    renderLesson();

    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mark as completed" }),
    ).not.toBeInTheDocument();
  });
});
