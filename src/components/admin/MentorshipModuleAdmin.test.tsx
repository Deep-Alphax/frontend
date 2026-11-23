import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { MentorshipModuleAdmin } from "./MentorshipModuleAdmin";
import * as api from "@/lib/api/mentorship";
import * as player from "@/lib/mentorship/player";
import { useSession } from "@/lib/auth/useSession";
import type {
  AdminCategory,
  AdminLesson,
  AdminModuleDetail,
  LessonPayload,
  ModulePayload,
} from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    getAdminModule: vi.fn(),
    listAdminCategories: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    createLesson: vi.fn(),
    updateLesson: vi.fn(),
    deleteLesson: vi.fn(),
    reorderLessons: vi.fn(),
    createMaterial: vi.fn(),
    deleteMaterial: vi.fn(),
    // Upload desligado aqui: o fluxo de upload tem teste próprio
    // (FileDropField.test). O link colado continua sendo o caminho testado.
    getUploadsConfig: vi.fn(async () => ({
      enabled: false,
      limits: { cover: 5 * 1024 * 1024, material: 50 * 1024 * 1024 },
      accept: { cover: ["webp", "png"], material: ["pdf", "zip"] },
    })),
  };
});
vi.mock("@/lib/auth/useSession");
// API JS do player (script externo) fora do jsdom; a auto-duração tem teste
// próprio logo abaixo, com eventos simulados.
vi.mock("@/lib/mentorship/player", () => ({ attachPlayer: vi.fn() }));
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
}));

function makeLesson(over: Partial<AdminLesson> = {}): AdminLesson {
  return {
    id: "l1",
    moduleId: "m1",
    title: "How a Solana transaction really happens",
    description: "",
    episode: 1,
    durationSec: 860,
    coverUrl: "",
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
    position: 0,
    published: true,
    materials: [],
    ...over,
  };
}

/**
 * Backend de mentira. `getAdminModule` devolve CÓPIA a cada chamada: com a
 * mesma referência, servir snapshot velho depois de um PATCH ficaria invisível.
 */
const server = {
  module: null as AdminModuleDetail | null,
  categories: [] as AdminCategory[],
  reset() {
    this.module = {
      id: "m1",
      categoryId: "c1",
      slug: "on-chain-fundamentals",
      title: "On-chain fundamentals",
      subtitle: "",
      label: "Module 1",
      coverUrl: "",
      accent: "GREEN",
      position: 0,
      published: false,
      lessons: [
        makeLesson(),
        makeLesson({
          id: "l2",
          title: "Fee and gas",
          episode: 2,
          position: 1,
          videoUrl: "",
          published: false,
        }),
      ],
    };
    this.categories = [
      {
        id: "c1",
        title: "Fundamentals",
        description: "",
        position: 0,
        published: true,
        modules: [],
      },
      {
        id: "c2",
        title: "Trading",
        description: "",
        position: 1,
        published: true,
        modules: [],
      },
    ];
  },
};

function wireApi() {
  vi.mocked(api.getAdminModule).mockImplementation(async () => {
    if (!server.module) throw new Error("404");
    return structuredClone(server.module);
  });
  vi.mocked(api.listAdminCategories).mockImplementation(async () =>
    structuredClone(server.categories),
  );
  vi.mocked(api.updateModule).mockImplementation(
    async (_id, patch: Partial<ModulePayload>) => {
      server.module = { ...server.module!, ...patch };
      const rest = { ...server.module, lessons: undefined };
      return { ...rest, lessonCount: server.module.lessons.length };
    },
  );
  vi.mocked(api.updateLesson).mockImplementation(
    async (id, patch: Partial<LessonPayload>) => {
      const lessons = server.module!.lessons.map((l) =>
        l.id === id ? { ...l, ...patch } : l,
      );
      server.module = { ...server.module!, lessons };
      return lessons.find((l) => l.id === id)!;
    },
  );
  vi.mocked(api.createLesson).mockImplementation(async (moduleId, payload) => {
    const created = makeLesson({ ...payload, id: "l9", moduleId, position: 2 });
    server.module = {
      ...server.module!,
      lessons: [...server.module!.lessons, created],
    };
    return created;
  });
  vi.mocked(api.createMaterial).mockImplementation(async (lessonId, p) => ({
    id: "mat9",
    lessonId,
    title: p.title,
    url: p.url,
    kind: p.kind,
    sizeBytes: p.sizeBytes ?? 0,
    position: 0,
  }));
  vi.mocked(api.reorderLessons).mockResolvedValue(undefined);
  vi.mocked(api.deleteModule).mockResolvedValue(undefined);
  // Por padrão o player "nunca fica pronto" (sem auto-duração).
  vi.mocked(player.attachPlayer).mockImplementation(() => new Promise(() => {}));
}

beforeEach(() => {
  vi.clearAllMocks();
  server.reset();
  wireApi();
  vi.mocked(useSession).mockReturnValue({
    profile: { role: "ADMIN" } as never,
    isAuthenticated: true,
    isLoading: false,
  });
});

const lessonRow = (title: string) =>
  screen.findByRole("button", { name: `Edit lesson ${title}` });

describe("MentorshipModuleAdmin — página", () => {
  it("breadcrumb, status e aulas numeradas pela ordem", async () => {
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    const crumbs = await screen.findByRole("navigation", { name: "Breadcrumb" });
    await waitFor(() => expect(crumbs).toHaveTextContent("Fundamentals"));
    expect(crumbs).toHaveTextContent("On-chain fundamentals");
    expect(within(crumbs).getByRole("link", { name: "Mentorship" })).toHaveAttribute(
      "href",
      "/admin/mentorship",
    );

    const second = await lessonRow("Fee and gas");
    expect(second).toHaveTextContent("EP 02");
    expect(second).toHaveTextContent("No video");
    expect(second).toHaveTextContent("Draft");
    expect(await lessonRow("How a Solana transaction really happens")).toHaveTextContent(
      "YouTube",
    );
  });

  it("publicar sem aula publicada pede confirmação antes", async () => {
    server.module!.lessons = server.module!.lessons.map((l) => ({
      ...l,
      published: false,
    }));
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(await screen.findByRole("button", { name: "Publish module" }));
    expect(confirm).toHaveBeenCalled();
    expect(api.updateModule).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Publish module" }));
    expect(vi.mocked(api.updateModule).mock.calls[0][1]).toEqual({ published: true });
    confirm.mockRestore();
  });

  it("avisa quando o módulo está publicado mas a categoria é rascunho", async () => {
    server.module!.published = true;
    server.categories[0].published = false;
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    expect(await screen.findByText(/publish the category to make it visible/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view on site/i })).not.toBeInTheDocument();
  });

  it("dados do módulo: só salva o que mudou e volta a 'Saved' depois", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    const form = await screen.findByRole("form", { name: "Module details" });
    expect(within(form).getByRole("button", { name: "Saved" })).toBeDisabled();

    const title = within(form).getByRole("textbox", { name: /^title$/i });
    await user.clear(title);
    await user.type(title, "On-chain basics");
    await user.click(within(form).getByRole("button", { name: "Save details" }));

    // Sem `categoryId`: mandá-lo à toa moveria o módulo para o fim da lista.
    expect(vi.mocked(api.updateModule).mock.calls[0][1]).toEqual({
      title: "On-chain basics",
    });
    expect(await within(form).findByRole("button", { name: "Saved" })).toBeDisabled();
  });

  it("↑ na alça da aula reordena e manda os ids da trilha", async () => {
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    fireEvent.keyDown(
      await screen.findByRole("button", { name: "Reorder Fee and gas" }),
      { key: "ArrowUp" },
    );

    await waitFor(() => expect(api.reorderLessons).toHaveBeenCalled());
    expect(vi.mocked(api.reorderLessons).mock.calls[0]).toEqual(["m1", ["l2", "l1"]]);
  });

  it("apagar o módulo confirma e volta para a árvore", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(await screen.findByRole("button", { name: "Delete module" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/mentorship"));
    expect(api.deleteModule).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it("módulo inexistente mostra o caminho de volta", async () => {
    server.module = null;
    renderWithQuery(<MentorshipModuleAdmin moduleId="nope" />);

    expect(await screen.findByText("Module not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to mentorship/i })).toHaveAttribute(
      "href",
      "/admin/mentorship",
    );
  });
});

describe("MentorshipModuleAdmin — painel da aula", () => {
  it("abre a aula num painel e salva a duração em SEGUNDOS", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(await lessonRow("How a Solana transaction really happens"));
    const panel = await screen.findByRole("dialog");
    expect(within(panel).getByText("EP 01")).toBeInTheDocument();
    // Episódio não é mais campo editável.
    expect(within(panel).queryByRole("spinbutton")).not.toBeInTheDocument();

    const duration = within(panel).getByRole("textbox", { name: /duration/i });
    await user.clear(duration);
    await user.type(duration, "12:30");
    await user.click(within(panel).getByRole("button", { name: "Save lesson" }));

    expect(vi.mocked(api.updateLesson).mock.calls[0][1]).toMatchObject({
      durationSec: 750,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("link de vídeo fora da allowlist bloqueia o salvar e explica", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(await lessonRow("Fee and gas"));
    const panel = await screen.findByRole("dialog");
    const video = within(panel).getByRole("textbox", { name: /video link/i });

    await user.click(video);
    await user.paste("https://drive.google.com/file/abc");
    expect(within(panel).getByText(/other links don't play for users/i)).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Save lesson" })).toBeDisabled();

    await user.clear(video);
    await user.click(video);
    await user.paste("https://vimeo.com/123456");
    expect(within(panel).getByText(/Vimeo video found/)).toBeInTheDocument();
    expect(within(panel).getByTitle("Video preview")).toHaveAttribute(
      "src",
      "https://player.vimeo.com/video/123456",
    );
    expect(within(panel).getByRole("button", { name: "Save lesson" })).toBeEnabled();
  });

  it("aula nova: materiais entram na fila e sobem DEPOIS da aula criada", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(
      (await screen.findAllByRole("button", { name: /add lesson/i }))[0],
    );
    const panel = await screen.findByRole("dialog", { name: "New lesson" });
    expect(within(panel).getByText("EP 03")).toBeInTheDocument();

    await user.type(within(panel).getByRole("textbox", { name: /^title$/i }), "Exits");
    await user.click(within(panel).getByLabelText("File link"));
      await user.paste("https://cdn.example.com/exit-checklist.pdf");
    await user.click(within(panel).getByRole("button", { name: /add material/i }));
    expect(api.createMaterial).not.toHaveBeenCalled();

    await user.click(within(panel).getByRole("button", { name: "Create lesson" }));

    await waitFor(() => expect(api.createMaterial).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.createLesson).mock.calls[0][0]).toBe("m1");
    expect(vi.mocked(api.createMaterial).mock.calls[0]).toEqual([
      "l9",
      {
        title: "exit-checklist.pdf",
        url: "https://cdn.example.com/exit-checklist.pdf",
        kind: "PDF",
        sizeBytes: 0,
      },
    ]);
  });

  it("duração vem do player quando o campo está vazio (e não sobrescreve)", async () => {
    vi.mocked(player.attachPlayer).mockImplementation(async (_iframe, _p, ev) => {
      ev.onReady?.(754.6); // 12:34 (para baixo, como o player mostra)
      return { destroy: vi.fn() };
    });
    const user = userEvent.setup();
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    // Aula nova: campo vazio → preenchido pelo vídeo.
    await user.click((await screen.findAllByRole("button", { name: /add lesson/i }))[0]);
    let panel = await screen.findByRole("dialog", { name: "New lesson" });
    await user.click(within(panel).getByRole("textbox", { name: /^video link/i }));
      await user.paste("https://vimeo.com/123456");
    const duration = within(panel).getByRole("textbox", { name: /^duration/i });
    await waitFor(() => expect(duration).toHaveValue("12:34"));
    expect(within(panel).getByText("Read from the video. Edit if needed.")).toBeInTheDocument();

    // Aula com duração já salva (14:20): o vídeo NÃO sobrescreve.
    await user.click(within(panel).getByRole("button", { name: "Cancel" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(await lessonRow("How a Solana transaction really happens"));
    panel = await screen.findByRole("dialog");
    expect(within(panel).getByRole("textbox", { name: /^duration/i })).toHaveValue("14:20");
  });

  it("Esc com alteração não salva pede confirmação", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<MentorshipModuleAdmin moduleId="m1" />);

    await user.click(await lessonRow("Fee and gas"));
    const panel = await screen.findByRole("dialog");
    await user.type(within(panel).getByRole("textbox", { name: /^title$/i }), "!");
    await user.keyboard("{Escape}");

    expect(confirm).toHaveBeenCalledWith("Discard the unsaved changes?");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    confirm.mockRestore();
  });
});
