import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { MentorshipAdmin } from "./MentorshipAdmin";
import * as api from "@/lib/api/mentorship";
import { useSession } from "@/lib/auth/useSession";
import type {
  AdminLesson,
  AdminModuleDetail,
  AdminModuleSummary,
  LessonPayload,
  ModulePayload,
} from "@/lib/api/mentorship";

vi.mock("@/lib/api/mentorship", async (importOriginal) => {
  // As chaves de query vêm do módulo real: inventá-las aqui faria o teste de
  // invalidação passar contra uma chave que a tela não usa.
  const actual = await importOriginal<typeof api>();
  return {
    ...actual,
    listAdminModules: vi.fn(),
    getAdminModule: vi.fn(),
    createModule: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    reorderModules: vi.fn(),
    createLesson: vi.fn(),
    updateLesson: vi.fn(),
    deleteLesson: vi.fn(),
    reorderLessons: vi.fn(),
  };
});
vi.mock("@/lib/auth/useSession");
vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockSession = vi.mocked(useSession);

function makeModule(over: Partial<AdminModuleSummary> = {}): AdminModuleSummary {
  return {
    id: "m1",
    slug: "on-chain-fundamentals",
    title: "On-chain fundamentals",
    subtitle: "Wallet, RPC, fee, gas.",
    label: "Module 1",
    coverUrl: "/mentorship/module-market.webp",
    accent: "GREEN",
    position: 0,
    published: true,
    lessonCount: 1,
    ...over,
  };
}

function makeLesson(over: Partial<AdminLesson> = {}): AdminLesson {
  return {
    id: "l1",
    moduleId: "m1",
    title: "How a Solana transaction really happens",
    description: "",
    episode: 1,
    durationSec: 860,
    coverUrl: "",
    videoUrl: "",
    position: 0,
    published: true,
    ...over,
  };
}

/**
 * Backend de mentira: guarda trilhas e aulas e aplica os PATCH.
 *
 * `getAdminModule` devolve uma CÓPIA a cada chamada. Sem isso o teste de
 * invalidação passaria por acidente — o editor receberia a mesma referência já
 * mutada pelo PATCH, e servir snapshot velho (o bug que se quer pegar) ficaria
 * invisível.
 */
const server = {
  modules: new Map<string, AdminModuleSummary>(),
  lessons: new Map<string, AdminLesson>(),
  reset() {
    this.modules = new Map([
      ["m1", makeModule()],
      ["m2", makeModule({ id: "m2", slug: "working-the-radar", title: "Working the Radar", label: "Module 2", position: 1, lessonCount: 0 })],
    ]);
    this.lessons = new Map([["l1", makeLesson()]]);
  },
};

function wireApi() {
  vi.mocked(api.listAdminModules).mockImplementation(async () =>
    [...server.modules.values()]
      .sort((a, b) => a.position - b.position)
      .map((m) => structuredClone(m)),
  );

  vi.mocked(api.getAdminModule).mockImplementation(async (id: string) => {
    const m = server.modules.get(id);
    if (!m) throw new Error(`404 ${id}`);
    const { lessonCount: _ignored, ...rest } = m;
    return structuredClone({
      ...rest,
      lessons: [...server.lessons.values()].filter((l) => l.moduleId === id),
    }) as AdminModuleDetail;
  });

  vi.mocked(api.updateModule).mockImplementation(
    async (id: string, patch: Partial<ModulePayload>) => {
      const next = { ...server.modules.get(id)!, ...patch };
      server.modules.set(id, next);
      return next;
    },
  );

  vi.mocked(api.createModule).mockImplementation(async (payload: ModulePayload) => {
    const next = makeModule({ ...payload, id: "m3", position: 2, lessonCount: 0 });
    server.modules.set(next.id, next);
    return next;
  });

  vi.mocked(api.reorderModules).mockImplementation(async (ids: string[]) => {
    ids.forEach((id, position) => {
      const m = server.modules.get(id);
      if (m) server.modules.set(id, { ...m, position });
    });
  });

  vi.mocked(api.deleteModule).mockImplementation(async (id: string) => {
    server.modules.delete(id);
  });

  vi.mocked(api.updateLesson).mockImplementation(
    async (id: string, patch: Partial<LessonPayload>) => {
      const next = { ...server.lessons.get(id)!, ...patch };
      server.lessons.set(id, next);
      return next;
    },
  );

  vi.mocked(api.createLesson).mockImplementation(
    async (moduleId: string, payload: LessonPayload) => {
      const next = makeLesson({ ...payload, id: "l2", moduleId, position: 1 });
      server.lessons.set(next.id, next);
      return next;
    },
  );
}

/** Abre o editor de uma trilha e espera o formulário montar. */
async function openEditor(
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) {
  await user.click(await screen.findByRole("button", { name: `Edit ${title}` }));
  return await screen.findByRole("textbox", { name: /^title$/i });
}

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
    expect(api.listAdminModules).not.toHaveBeenCalled();
  });

  it("barra quem não é ADMIN e não lista as trilhas", () => {
    mockSession.mockReturnValue({
      profile: { role: "USER" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    renderWithQuery(<MentorshipAdmin />);
    expect(screen.getByText("Restricted access")).toBeInTheDocument();
    expect(api.listAdminModules).not.toHaveBeenCalled();
  });
});

describe("MentorshipAdmin — trilhas", () => {
  it("lista as trilhas na ordem, com slug e contagem de aulas", async () => {
    renderWithQuery(<MentorshipAdmin />);

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]).getByText("On-chain fundamentals")).toBeInTheDocument();
    expect(within(items[0]).getByText(/on-chain-fundamentals · 1 lesson/)).toBeInTheDocument();
    expect(within(items[1]).getByText("Working the Radar")).toBeInTheDocument();
  });

  it("marca rascunho e não some com ele da lista do admin", async () => {
    server.modules.set("m2", makeModule({ ...server.modules.get("m2")!, published: false }));
    renderWithQuery(<MentorshipAdmin />);

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Working the Radar")).toBeInTheDocument();
  });

  it("salva a edição e REABRE o editor já com o valor novo", async () => {
    // É a classe de bug do preset de KOLs: sem invalidar a chave do detalhe, o
    // editor renasce de um snapshot anterior ao PATCH e regrava o valor velho.
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    const title = await openEditor(user, "On-chain fundamentals");
    await user.clear(title);
    await user.type(title, "On-chain basics");
    await user.click(screen.getByRole("button", { name: /save track/i }));

    expect(api.updateModule).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.updateModule).mock.calls[0][1]).toMatchObject({
      title: "On-chain basics",
    });

    const reopened = await openEditor(user, "On-chain basics");
    expect(reopened).toHaveValue("On-chain basics");
  });

  it("deriva o slug do título até alguém digitá-lo à mão", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.click(await screen.findByRole("button", { name: /new track/i }));
    await user.type(
      await screen.findByRole("textbox", { name: /^title$/i }),
      "Exit & Post-Trade",
    );
    expect(screen.getByRole("textbox", { name: /slug/i })).toHaveValue(
      "exit-post-trade",
    );
  });

  it("não deixa mais o título reescrever um slug já digitado à mão", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.click(await screen.findByRole("button", { name: /new track/i }));
    const slug = await screen.findByRole("textbox", { name: /slug/i });
    // Digitar o hífen tem que funcionar: normalizar a ponta a cada tecla o
    // apagaria no instante da digitação e sairia "myurl".
    await user.type(slug, "my-url");
    expect(slug).toHaveValue("my-url");

    await user.type(screen.getByRole("textbox", { name: /^title$/i }), "Anything");

    // O slug pode já estar numa URL compartilhada — mexer no título não o toca.
    expect(slug).toHaveValue("my-url");
  });

  it("apara o hífen sobrando quando o campo de slug perde o foco", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.click(await screen.findByRole("button", { name: /new track/i }));
    const slug = await screen.findByRole("textbox", { name: /slug/i });
    await user.type(slug, "half-typed-");
    await user.tab();

    expect(slug).toHaveValue("half-typed");
  });

  it("reordena mandando a lista INTEIRA de ids na nova ordem", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await user.click(
      await screen.findByRole("button", { name: /move working the radar up/i }),
    );

    expect(vi.mocked(api.reorderModules).mock.calls[0][0]).toEqual(["m2", "m1"]);
  });

  it("desabilita a seta que não tem para onde ir", async () => {
    renderWithQuery(<MentorshipAdmin />);

    expect(
      await screen.findByRole("button", { name: /move on-chain fundamentals up/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /move working the radar down/i }),
    ).toBeDisabled();
  });

  it("só apaga depois de confirmar", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<MentorshipAdmin />);

    await user.click(
      await screen.findByRole("button", { name: /delete on-chain fundamentals/i }),
    );
    expect(api.deleteModule).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await user.click(
      screen.getByRole("button", { name: /delete on-chain fundamentals/i }),
    );
    // `mutationFn` passado direto recebe (variáveis, contexto): asserção por
    // aridade (`toHaveBeenCalledWith`) falha mesmo com o argumento certo.
    expect(vi.mocked(api.deleteModule).mock.calls[0][0]).toBe("m1");
    confirm.mockRestore();
  });
});

describe("MentorshipAdmin — aulas", () => {
  it("lista as aulas da trilha aberta", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await openEditor(user, "On-chain fundamentals");
    expect(
      await screen.findByText("How a Solana transaction really happens"),
    ).toBeInTheDocument();
    expect(screen.getByText("14:20")).toBeInTheDocument();
  });

  it("manda a duração em SEGUNDOS mesmo digitada como mm:ss", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await openEditor(user, "On-chain fundamentals");
    await user.click(await screen.findByRole("button", { name: /edit lesson/i }));

    const duration = await screen.findByRole("textbox", { name: /duration/i });
    await user.clear(duration);
    await user.type(duration, "12:30");
    await user.click(screen.getByRole("button", { name: /save lesson/i }));

    expect(vi.mocked(api.updateLesson).mock.calls[0][1]).toMatchObject({
      durationSec: 750,
    });
  });

  it("bloqueia o salvar quando a duração não é uma duração", async () => {
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await openEditor(user, "On-chain fundamentals");
    await user.click(await screen.findByRole("button", { name: /edit lesson/i }));

    const duration = await screen.findByRole("textbox", { name: /duration/i });
    await user.clear(duration);
    await user.type(duration, "quinze minutos");

    expect(screen.getByRole("button", { name: /save lesson/i })).toBeDisabled();
    expect(api.updateLesson).not.toHaveBeenCalled();
  });

  it("reordena as aulas dentro da trilha", async () => {
    server.lessons.set("l2", makeLesson({ id: "l2", title: "Fee and gas", episode: 2, position: 1 }));
    const user = userEvent.setup();
    renderWithQuery(<MentorshipAdmin />);

    await openEditor(user, "On-chain fundamentals");
    const buttons = await screen.findAllByRole("button", { name: /move up/i });
    await user.click(buttons[buttons.length - 1]);

    expect(vi.mocked(api.reorderLessons).mock.calls[0]).toEqual(["m1", ["l2", "l1"]]);
  });
});
