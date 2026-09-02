import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { KolsAdmin } from "./KolsAdmin";
import * as api from "@/lib/api/walletReader";
import { useSession } from "@/lib/auth/useSession";
import { fileToAvatar } from "@/lib/walletReader/avatar";
import type {
  KolPresetAdminEntry,
  KolPresetAdminPage,
  KolPresetPatch,
} from "@/lib/api/walletReader";

vi.mock("@/lib/api/walletReader");
vi.mock("@/lib/auth/useSession");
vi.mock("@/lib/walletReader/avatar");

/** `fileToAvatar` usa canvas, que o jsdom não implementa — o data URL é fixo. */
const AVATAR_DATA_URL = "data:image/jpeg;base64,NOVO";

const mockSession = vi.mocked(useSession);

/**
 * Backend de mentira do preset: guarda o KOL e aplica o PATCH nele.
 *
 * `getKolPresetOne` devolve uma CÓPIA a cada chamada — sem isso o teste passaria
 * por acidente (o editor receberia a mesma referência já mutada pelo PATCH, e o
 * bug de cache, que é justamente servir um snapshot velho, ficaria invisível).
 */
const server = {
  kols: new Map<string, KolPresetAdminEntry>(),
  reset() {
    this.kols = new Map([
      [
        "k1",
        {
          id: "k1",
          name: "Ansem",
          wallets: [{ name: "main", address: "So1ana111" }],
          squads: ["Lair"],
          relevance: 80,
          types: ["alpha"],
          twitter: "blknoiz06",
          notes: "descrição antiga",
          avatar: null,
          deletedAt: null,
        } satisfies KolPresetAdminEntry,
      ],
    ]);
  },
};

function wireApi() {
  vi.mocked(api.getKolPresetAdmin).mockImplementation(
    async (): Promise<KolPresetAdminPage> => ({
      items: [...server.kols.values()].map(({ wallets, ...rest }) => ({
        ...rest,
        walletCount: wallets.length,
      })),
      total: server.kols.size,
    }),
  );

  vi.mocked(api.getKolPresetOne).mockImplementation(async (id: string) => {
    const kol = server.kols.get(id);
    if (!kol) throw new Error(`404 ${id}`);
    return structuredClone(kol);
  });

  vi.mocked(api.updateKolPreset).mockImplementation(
    async (id: string, patch: KolPresetPatch) => {
      const kol = server.kols.get(id)!;
      const next = { ...kol, ...patch };
      server.kols.set(id, next);
      return next;
    },
  );

  vi.mocked(api.createKolPreset).mockImplementation(async (input) => {
    const id = `k${server.kols.size + 1}`;
    const next: KolPresetAdminEntry = {
      id,
      name: input.name,
      wallets: input.wallets ?? [],
      squads: input.squads ?? [],
      relevance: input.relevance ?? 20,
      types: input.types ?? [],
      twitter: input.twitter ?? "",
      notes: input.notes ?? "",
      avatar: input.avatar ?? null,
      deletedAt: null,
    };
    server.kols.set(id, next);
    return next;
  });
}

/** Abre o editor de um KOL do preset (clique no card) e espera o form montar. */
async function openEditor(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `Abrir ${name}` }));
  return await screen.findByRole("textbox", { name: /notas/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  server.reset();
  wireApi();
  vi.mocked(fileToAvatar).mockResolvedValue(AVATAR_DATA_URL);
  mockSession.mockReturnValue({
    profile: { role: "ADMIN" } as never,
    isAuthenticated: true,
    isLoading: false,
  });
});

describe("KolsAdmin — acesso", () => {
  it("pede login quando não há sessão", () => {
    mockSession.mockReturnValue({
      profile: undefined,
      isAuthenticated: false,
      isLoading: false,
    });
    renderWithQuery(<KolsAdmin />);
    expect(screen.getByText("Faça login para acessar.")).toBeInTheDocument();
    expect(api.getKolPresetAdmin).not.toHaveBeenCalled();
  });

  it("barra quem não é ADMIN e não consulta o preset", () => {
    mockSession.mockReturnValue({
      profile: { role: "USER" } as never,
      isAuthenticated: true,
      isLoading: false,
    });
    renderWithQuery(<KolsAdmin />);
    expect(screen.getByText("Acesso restrito")).toBeInTheDocument();
    expect(api.getKolPresetAdmin).not.toHaveBeenCalled();
  });
});

describe("KolsAdmin — salvar", () => {
  it("manda a descrição no PATCH do preset", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    const notes = await openEditor(user, "Ansem");
    await user.clear(notes);
    await user.type(notes, "descrição nova");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    await waitFor(() =>
      expect(api.updateKolPreset).toHaveBeenCalledWith(
        "k1",
        expect.objectContaining({ notes: "descrição nova" }),
      ),
    );
  });

  it("mostra a descrição salva ao reabrir o editor, sem recarregar a página", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    const notes = await openEditor(user, "Ansem");
    await user.clear(notes);
    await user.type(notes, "descrição nova");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    // O editor fecha sozinho no sucesso.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Salvar preset" })).toBeNull(),
    );

    // Regressão: o cache do KOL individual (`staleTime` 60s) servia o snapshot
    // anterior ao PATCH e o rascunho do editor nascia dele — a descrição
    // reaparecia como estava antes e só um F5 mostrava a verdade.
    const reopened = await openEditor(user, "Ansem");
    expect(reopened).toHaveValue("descrição nova");
  });

  it("não regrava a descrição velha por cima ao salvar outro campo depois", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    const notes = await openEditor(user, "Ansem");
    await user.clear(notes);
    await user.type(notes, "descrição nova");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Salvar preset" })).toBeNull(),
    );

    // Segunda edição mexendo SÓ no nome. `draftToPatch` manda todos os campos,
    // então um rascunho semeado com cache velho apagaria a descrição recém-salva.
    await openEditor(user, "Ansem");
    const name = screen.getByRole("textbox", { name: /nome/i });
    await user.clear(name);
    await user.type(name, "Ansem 2");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    await waitFor(() => expect(api.updateKolPreset).toHaveBeenCalledTimes(2));
    expect(api.updateKolPreset).toHaveBeenLastCalledWith(
      "k1",
      expect.objectContaining({ name: "Ansem 2", notes: "descrição nova" }),
    );
    expect(server.kols.get("k1")!.notes).toBe("descrição nova");
  });

  it("atualiza a listagem depois de salvar, sem refresh", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await openEditor(user, "Ansem");
    const name = screen.getByRole("textbox", { name: /nome/i });
    await user.clear(name);
    await user.type(name, "Ansem renomeado");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    expect(await screen.findByText("Ansem renomeado")).toBeInTheDocument();
  });

  it("não deixa salvar um KOL sem nome", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await openEditor(user, "Ansem");
    await user.clear(screen.getByRole("textbox", { name: /nome/i }));

    expect(screen.getByRole("button", { name: "Salvar preset" })).toBeDisabled();
  });
});

describe("KolsAdmin — remover e restaurar", () => {
  it("remove do preset após confirmação e restaura depois", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(api.deleteKolPreset).mockImplementation(async (id: string) => {
      server.kols.set(id, { ...server.kols.get(id)!, deletedAt: Date.now() });
    });
    vi.mocked(api.restoreKolPreset).mockImplementation(async (id: string) => {
      server.kols.set(id, { ...server.kols.get(id)!, deletedAt: null });
    });

    renderWithQuery(<KolsAdmin />);

    await user.click(
      await screen.findByRole("button", { name: "Remover Ansem do preset" }),
    );
    expect(await screen.findByText("removido")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restaurar Ansem" }));
    await waitFor(() => expect(screen.queryByText("removido")).toBeNull());
  });

  it("não remove quando a confirmação é cancelada", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<KolsAdmin />);

    await user.click(
      await screen.findByRole("button", { name: "Remover Ansem do preset" }),
    );
    expect(api.deleteKolPreset).not.toHaveBeenCalled();
  });
});

describe("KolsAdmin — todos os campos do KOL", () => {
  /** Muda TODO campo editável do preset e devolve o que deve chegar no PATCH. */
  async function editEveryField(user: ReturnType<typeof userEvent.setup>) {
    const notes = await openEditor(user, "Ansem");

    await user.clear(screen.getByRole("textbox", { name: /nome/i }));
    await user.type(screen.getByRole("textbox", { name: /nome/i }), "Ansem Novo");

    await user.clear(notes);
    await user.type(notes, "descrição nova");

    // O handle vai sem "@" para o backend, mesmo digitado com ele.
    await user.clear(screen.getByRole("textbox", { name: /twitter/i }));
    await user.type(screen.getByRole("textbox", { name: /twitter/i }), "@novohandle");

    // Squads viajam como lista: a string é quebrada na vírgula e aparada.
    await user.clear(screen.getByRole("textbox", { name: /squads/i }));
    await user.type(screen.getByRole("textbox", { name: /squads/i }), " Lair , Pastel Alpha ");

    // O range não responde a teclado do user-event de forma estável.
    fireEvent.change(screen.getByRole("slider"), { target: { value: "42" } });

    // Tipos: desmarca o que veio e marca outro.
    await user.click(screen.getByRole("button", { name: "Alpha Caller" }));
    await user.click(screen.getByRole("button", { name: "Whale" }));

    // Carteiras: remove a que existia e adiciona outra.
    await user.click(screen.getByRole("button", { name: "Remover So1ana111" }));
    await user.type(screen.getByPlaceholderText("apelido"), "cold");
    await user.type(screen.getByPlaceholderText("endereço on-chain"), "So1ana222");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));

    return {
      name: "Ansem Novo",
      notes: "descrição nova",
      twitter: "novohandle",
      squads: ["Lair", "Pastel Alpha"],
      relevance: 42,
      types: ["whale"],
      avatar: null,
      wallets: [{ name: "cold", address: "So1ana222" }],
    };
  }

  it("manda todos os campos editados no PATCH", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    const expected = await editEveryField(user);
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    await waitFor(() => expect(api.updateKolPreset).toHaveBeenCalledTimes(1));
    expect(api.updateKolPreset).toHaveBeenCalledWith("k1", expected);
  });

  it("reabre o editor com todos os campos como foram salvos", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    const expected = await editEveryField(user);
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Salvar preset" })).toBeNull(),
    );

    await openEditor(user, "Ansem Novo");

    expect(screen.getByRole("textbox", { name: /nome/i })).toHaveValue(expected.name);
    expect(screen.getByRole("textbox", { name: /notas/i })).toHaveValue(expected.notes);
    expect(screen.getByRole("textbox", { name: /twitter/i })).toHaveValue(expected.twitter);
    expect(screen.getByRole("textbox", { name: /squads/i })).toHaveValue("Lair, Pastel Alpha");
    expect(screen.getByRole("slider")).toHaveValue("42");
    expect(screen.getByRole("button", { name: "Whale" })).toHaveClass("bg-principal-3");
    expect(screen.getByRole("button", { name: "Alpha Caller" })).not.toHaveClass(
      "bg-principal-3",
    );
    expect(screen.getByText("So1ana222")).toBeInTheDocument();
    expect(screen.queryByText("So1ana111")).toBeNull();
  });

  it("a listagem reflete nome, relevância, squads e nº de carteiras sem refresh", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await editEveryField(user);
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    expect(await screen.findByText("Ansem Novo")).toBeInTheDocument();
    expect(screen.getByText("42/100")).toBeInTheDocument();
    // Vários squads sob o nome saem "Squad1, Squad2".
    expect(screen.getByText("Lair, Pastel Alpha")).toBeInTheDocument();
  });

  it("troca e remove o avatar", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await openEditor(user, "Ansem");
    // O input de arquivo é o único do editor; `fileToAvatar` está mockado.
    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "foto.png", { type: "image/png" }),
    );
    await user.click(await screen.findByRole("button", { name: "Salvar preset" }));

    await waitFor(() =>
      expect(api.updateKolPreset).toHaveBeenCalledWith(
        "k1",
        expect.objectContaining({ avatar: AVATAR_DATA_URL }),
      ),
    );

    await openEditor(user, "Ansem");
    await user.click(screen.getByRole("button", { name: "remover foto" }));
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    await waitFor(() =>
      expect(api.updateKolPreset).toHaveBeenLastCalledWith(
        "k1",
        expect.objectContaining({ avatar: null }),
      ),
    );
  });

  it("ignora carteira sem endereço e não duplica endereço já cadastrado", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await openEditor(user, "Ansem");

    // Sem endereço: nada é adicionado.
    await user.type(screen.getByPlaceholderText("apelido"), "vazia");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Carteiras (1)")).toBeInTheDocument();

    // Endereço repetido: nada é adicionado.
    await user.type(screen.getByPlaceholderText("endereço on-chain"), "So1ana111");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    expect(screen.getByText("Carteiras (1)")).toBeInTheDocument();
  });

  it("cria um KOL novo no preset com os campos preenchidos", async () => {
    const user = userEvent.setup();
    renderWithQuery(<KolsAdmin />);

    await user.click(await screen.findByRole("button", { name: /adicionar kol/i }));
    await user.type(
      await screen.findByRole("textbox", { name: /nome/i }),
      "Novo KOL",
    );
    await user.type(screen.getByRole("textbox", { name: /notas/i }), "primeira nota");
    await user.type(screen.getByRole("textbox", { name: /twitter/i }), "novo");
    await user.click(screen.getByRole("button", { name: "Salvar preset" }));

    await waitFor(() =>
      // `createKolPreset` é o mutationFn direto: o React Query passa
      // (variáveis, contexto), então a asserção olha só o 1º argumento.
      expect(vi.mocked(api.createKolPreset).mock.calls[0]?.[0]).toMatchObject({
        name: "Novo KOL",
        notes: "primeira nota",
        twitter: "novo",
      }),
    );
    expect(await screen.findByText("Novo KOL")).toBeInTheDocument();
  });
});
