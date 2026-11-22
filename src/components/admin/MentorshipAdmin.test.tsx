import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";

import { renderWithQuery } from "@/test/queryWrapper";
import { MentorshipAdmin } from "./MentorshipAdmin";
import * as api from "@/lib/api/mentorship";
import { useSession } from "@/lib/auth/useSession";
import type {
  AdminCategory,
  AdminModuleSummary,
  ModulePayload,
} from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  // As chaves de query vêm do módulo real: inventá-las aqui faria o teste de
  // invalidação passar contra uma chave que a tela não usa.
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    listAdminCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    reorderCategories: vi.fn(),
    createModule: vi.fn(),
    reorderModules: vi.fn(),
  };
});
vi.mock("@/lib/auth/useSession");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
}));
// A aba "Usage" tem testes próprios; aqui só atrapalharia com outra query.
vi.mock("@/components/admin/MentorshipStats", () => ({
  MentorshipStats: () => <div>stats</div>,
}));

const mockSession = vi.mocked(useSession);

function makeModule(over: Partial<AdminModuleSummary> = {}): AdminModuleSummary {
  return {
    id: "m1",
    categoryId: "c1",
    slug: "on-chain-fundamentals",
    title: "On-chain fundamentals",
    subtitle: "",
    label: "Module 1",
    coverUrl: "",
    accent: "GREEN",
    position: 0,
    published: true,
    lessonCount: 3,
    ...over,
  };
}

type CategoryRow = Omit<AdminCategory, "modules">;

/** Backend de mentira: categorias e módulos, montando a árvore como a API. */
const server = {
  categories: new Map<string, CategoryRow>(),
  modules: new Map<string, AdminModuleSummary>(),
  reset() {
    this.categories = new Map([
      ["c1", { id: "c1", title: "Fundamentals", description: "", position: 0, published: true }],
      ["c2", { id: "c2", title: "Trading", description: "", position: 1, published: false }],
    ]);
    this.modules = new Map([
      ["m1", makeModule()],
      [
        "m2",
        makeModule({
          id: "m2",
          slug: "working-the-radar",
          title: "Working the Radar",
          position: 1,
          lessonCount: 0,
          published: false,
        }),
      ],
      [
        "m3",
        makeModule({
          id: "m3",
          categoryId: "c2",
          slug: "exit-plans",
          title: "Exit plans",
        }),
      ],
    ]);
  },
};

function wireApi() {
  vi.mocked(api.listAdminCategories).mockImplementation(async () =>
    [...server.categories.values()]
      .sort((a, b) => a.position - b.position)
      .map((c) =>
        structuredClone({
          ...c,
          modules: [...server.modules.values()]
            .filter((m) => m.categoryId === c.id)
            .sort((a, b) => a.position - b.position),
        }),
      ),
  );
  vi.mocked(api.createCategory).mockImplementation(async (payload) => {
    const next = { ...payload, id: "c9", position: 9 };
    server.categories.set(next.id, next);
    return { ...next, modules: [] };
  });
  vi.mocked(api.deleteCategory).mockImplementation(async (id) => {
    server.categories.delete(id);
  });
  vi.mocked(api.reorderCategories).mockImplementation(async (ids) => {
    ids.forEach((id, position) => {
      const c = server.categories.get(id);
      if (c) server.categories.set(id, { ...c, position });
    });
  });
  vi.mocked(api.reorderModules).mockImplementation(async (_cat, ids) => {
    ids.forEach((id, position) => {
      const m = server.modules.get(id);
      if (m) server.modules.set(id, { ...m, position });
    });
  });
  vi.mocked(api.createModule).mockImplementation(async (payload: ModulePayload) => {
    const next = makeModule({ ...payload, id: "m9", lessonCount: 0 });
    server.modules.set(next.id, next);
    return next;
  });
}

const region = (name: string) =>
  screen.findByRole("region", { name: `Category ${name}` });

beforeEach(() => {
  vi.clearAllMocks();
  server.reset();
  wireApi();
  mockSession.mockReturnValue({
    profile: { role: "ADMIN" } as never,
    isAuthenticated: true,
    isLoading: false,
  });
});

describe("MentorshipAdmin — acesso", () => {
  it("pede login quando não há sessão e não consulta a API", () => {
    mockSession.mockReturnValue({
      profile: undefined,
      isAuthenticated: false,
      isLoading: false,
    });
    renderWithQuery(<MentorshipAdmin />);
    expect(screen.getByText("Sign in to continue.")).toBeInTheDocument();
    expect(api.listAdminCategories).not.toHaveBeenCalled();
  });

  it("barra quem não é ADMIN e não lista nada", () => {
    mockSession.mockReturnValue({
      profile: { role: "USER" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    renderWithQuery(<MentorshipAdmin />);
    expect(screen.getByText("Restricted access")).toBeInTheDocument();
    expect(api.listAdminCategories).not.toHaveBeenCalled();
  });
});

describe("MentorshipAdmin — árvore", () => {
  it("mostra cada categoria com os módulos DELA", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const fundamentals = await region("Fundamentals");
    const trading = await region("Trading");
    expect(within(fundamentals).getByText("On-chain fundamentals")).toBeInTheDocument();
    expect(within(fundamentals).getByText("Working the Radar")).toBeInTheDocument();
    expect(within(trading).getByText("Exit plans")).toBeInTheDocument();
    expect(within(trading).queryByText("Working the Radar")).not.toBeInTheDocument();
  });

  it("diz o que falta: rascunho, sem aulas e escondido pela categoria", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const radar = (await screen.findByText("Working the Radar")).closest("li")!;
    expect(within(radar).getByText("Draft")).toBeInTheDocument();
    expect(within(radar).getByText("No lessons")).toBeInTheDocument();

    // "Exit plans" está publicado, mas a categoria Trading é rascunho.
    const exit = screen.getByText("Exit plans").closest("li")!;
    expect(within(exit).getByText(/Hidden · category draft/)).toBeInTheDocument();
  });

  it("o módulo é um link para a página dele", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const link = (await screen.findByText("On-chain fundamentals")).closest("a");
    expect(link).toHaveAttribute("href", "/admin/mentorship/modules/m1");
  });

  it("estado vazio explica os três níveis e oferece criar a categoria", async () => {
    server.categories.clear();
    server.modules.clear();
    renderWithQuery(<MentorshipAdmin />);

    expect(await screen.findByText("Create a category")).toBeInTheDocument();
    expect(screen.getByText("Add lessons to each module")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create the first category/i }),
    ).toBeInTheDocument();
  });
});

describe("MentorshipAdmin — módulo novo", () => {
  async function openNewModule(user: ReturnType<typeof userEvent.setup>, category: string) {
    const section = await region(category);
    await user.click(within(section).getAllByRole("button", { name: /module/i })[0]);
    return screen.findByRole("textbox", { name: /^title$/i });
  }

  it("nasce RASCUNHO na categoria clicada e leva para a página dele", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.type(await openNewModule(user, "Trading"), "Risk control");
    await user.click(screen.getByRole("button", { name: /create and add lessons/i }));

    expect(vi.mocked(api.createModule).mock.calls[0][0]).toMatchObject({
      categoryId: "c2",
      title: "Risk control",
      slug: "risk-control",
      published: false,
    });
    expect(push).toHaveBeenCalledWith("/admin/mentorship/modules/m9");
  });

  it("deriva o slug do título até alguém digitá-lo à mão", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    const title = await openNewModule(user, "Fundamentals");
    const slug = screen.getByRole("textbox", { name: /slug/i });
    await user.type(title, "Exit & Post-Trade");
    expect(slug).toHaveValue("exit-post-trade");

    await user.clear(slug);
    // Digitar o hífen tem que funcionar: aparar a ponta a cada tecla o apagaria.
    await user.type(slug, "my-url");
    await user.type(title, " again");
    expect(slug).toHaveValue("my-url");
  });

  it("apara o hífen sobrando quando o slug perde o foco", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await openNewModule(user, "Fundamentals");
    const slug = screen.getByRole("textbox", { name: /slug/i });
    await user.type(slug, "half-typed-");
    await user.tab();
    expect(slug).toHaveValue("half-typed");
  });
});

describe("MentorshipAdmin — categorias", () => {
  it("cria categoria pelo título (aparado)", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.click(await screen.findByRole("button", { name: /new category/i }));
    await user.type(
      await screen.findByRole("textbox", { name: /^title/i }),
      "  On-chain  ",
    );
    await user.click(screen.getByRole("button", { name: /save category/i }));

    expect(vi.mocked(api.createCategory).mock.calls[0][0]).toEqual({
      title: "On-chain",
      description: "",
      published: true,
    });
  });

  it("não tenta apagar categoria com módulos: avisa o que fazer", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm");
    renderWithQuery(<MentorshipAdmin />);

    await user.click(
      await screen.findByRole("button", { name: /delete category fundamentals/i }),
    );

    expect(api.deleteCategory).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/still has 2 module\(s\)/);
    confirm.mockRestore();
  });

  it("apaga categoria vazia depois de confirmar", async () => {
    server.modules.delete("m3");
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithQuery(<MentorshipAdmin />);

    await user.click(
      await screen.findByRole("button", { name: /delete category trading/i }),
    );

    expect(vi.mocked(api.deleteCategory).mock.calls[0][0]).toBe("c2");
    confirm.mockRestore();
  });
});

describe("MentorshipAdmin — ordenar", () => {
  it("teclado: ↓ na alça da categoria manda todos os ids na nova ordem", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const handle = await screen.findByRole("button", {
      name: "Reorder category Fundamentals",
    });
    fireEvent.keyDown(handle, { key: "ArrowDown" });

    // `mutate` chama a API num microtask, não no mesmo tick.
    await waitFor(() => expect(api.reorderCategories).toHaveBeenCalled());
    expect(vi.mocked(api.reorderCategories).mock.calls[0][0]).toEqual(["c2", "c1"]);
  });

  it("teclado: ↑ na alça do módulo reordena SÓ dentro da categoria", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const handle = await screen.findByRole("button", {
      name: "Reorder Working the Radar",
    });
    fireEvent.keyDown(handle, { key: "ArrowUp" });

    await waitFor(() => expect(api.reorderModules).toHaveBeenCalled());
    expect(vi.mocked(api.reorderModules).mock.calls[0]).toEqual(["c1", ["m2", "m1"]]);
  });

  it("arrastar: a ordem muda na tela e a API é chamada UMA vez, ao soltar", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const first = (await screen.findByText("On-chain fundamentals")).closest("li")!;
    const second = screen.getByText("Working the Radar").closest("li")!;

    fireEvent.dragStart(first);
    fireEvent.dragOver(second);
    // Depois da troca o cursor fica sobre o PRÓPRIO item arrastado (ele ocupou
    // o lugar do outro): mais dragover nele não pode mexer em nada.
    fireEvent.dragOver(first);
    fireEvent.dragOver(first);

    // Otimista: já aparece na ordem nova antes do servidor responder.
    const items = within(await region("Fundamentals")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Working the Radar");

    // Nada vai ao servidor enquanto arrasta — só ao soltar.
    await new Promise((r) => setTimeout(r, 0));
    expect(api.reorderModules).not.toHaveBeenCalled();

    fireEvent.dragEnd(first);
    await waitFor(() => expect(api.reorderModules).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.reorderModules).mock.calls[0]).toEqual(["c1", ["m2", "m1"]]);
  });

  it("soltar na mesma ordem não chama a API", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const first = (await screen.findByText("On-chain fundamentals")).closest("li")!;
    fireEvent.dragStart(first);
    fireEvent.dragOver(first);
    fireEvent.dragEnd(first);

    await new Promise((r) => setTimeout(r, 0));
    expect(api.reorderModules).not.toHaveBeenCalled();
  });
});
