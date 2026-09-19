import { describe, it, expect, beforeEach, vi } from "vitest";
import { useState } from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithQuery } from "@/test/queryWrapper";
import { KolProfileModal } from "./KolProfileModal";
import { useKolIndex } from "@/lib/walletReader/useKolIndex";
import * as api from "@/lib/api/walletReader";
import { fileToAvatar } from "@/lib/walletReader/avatar";
import { useKolScans, useScans } from "@/lib/walletReader/useScans";
import type { KolIndexPage, KolOverridePatch } from "@/lib/api/walletReader";
import type { KolState } from "@/lib/walletReader/types";

vi.mock("@/lib/api/walletReader");
vi.mock("@/lib/walletReader/avatar");
// O bloco de sidewallets abre socket e consulta scans — fora do escopo aqui.
vi.mock("@/lib/walletReader/useScans", () => ({
  useScans: vi.fn(() => ({ scans: {}, runScan: vi.fn() })),
  useKolScans: vi.fn(() => []),
}));

/** `fileToAvatar` usa canvas, que o jsdom não implementa. */
const AVATAR_DATA_URL = "data:image/jpeg;base64,NOVO";

/**
 * Backend de mentira da CONTA do usuário: o override é aplicado sobre o estado
 * efetivo do KOL. `getKol` devolve uma cópia a cada chamada — sem isso o teste
 * não distinguiria "refez a busca" de "serviu o cache velho".
 */
const server = {
  kol: {} as KolState,
  reset() {
    this.kol = {
      id: "k1",
      name: "Ansem",
      wallets: [{ name: "main", address: "So1ana111" }],
      walletCount: 1,
      // "Lair" vem do PRESET (global, só o admin escreve); "Meu FnF" é da
      // conta. Para a tela os dois são squad — a diferença é só quem pode tirar.
      squads: ["Lair", "Meu FnF"],
      ownSquads: ["Meu FnF"],
      seedRelevance: 80,
      isCustom: false,
      relevance: 80,
      types: ["alpha"],
      twitter: "blknoiz06",
      notes: "nota antiga",
      avatar: null,
      dismissedSidewallets: [],
    };
  },
};

function wireApi() {
  vi.mocked(api.getKolIndex).mockImplementation(
    async (): Promise<KolIndexPage> => {
      // A listagem não carrega os endereços — só a contagem.
      const item = { ...server.kol, walletCount: server.kol.wallets.length };
      delete (item as Partial<KolState>).wallets;
      return {
        items: [item],
        total: 1,
        counts: { byTier: {}, byType: {}, bySquad: {} },
        viewCounts: {},
        // A faceta traz todo squad visível — inclusive um que só existe em
        // OUTRO KOL, que é o que alimenta as sugestões do modal.
        squads: [...server.kol.squads, "Outro Squad"],
      };
    },
  );

  vi.mocked(api.getKol).mockImplementation(async () => structuredClone(server.kol));

  vi.mocked(api.patchKolOverride).mockImplementation(
    async (kolId: string, patch: KolOverridePatch) => {
      const { wallets, avatar, squads, ...rest } = patch;
      Object.assign(server.kol, rest);
      if (wallets) server.kol.wallets = wallets;
      // O servidor guarda só os squads DA CONTA e devolve a união com o preset.
      if (squads !== undefined) {
        server.kol.ownSquads = squads ?? [];
        server.kol.squads = ["Lair", ...server.kol.ownSquads];
      }
      // Convenção do backend: `""` limpa a foto, `null` volta a herdar o preset.
      if (avatar !== undefined) server.kol.avatar = avatar === "" ? null : avatar;
      server.kol.walletCount = server.kol.wallets.length;
      return { kolId, updatedAt: Date.now() } as never;
    },
  );

}

/**
 * Tela mínima com o MESMO encanamento da real: o modal remonta por `key={id}` e
 * o índice vem do hook de verdade, que é quem invalida o cache após o PATCH.
 */
function Harness() {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = useKolIndex({});
  return (
    <>
      <button type="button" onClick={() => setOpenId("k1")}>
        open kol
      </button>
      {openId && (
        <KolProfileModal
          key={openId}
          id={openId}
          index={index}
          onClose={() => setOpenId(null)}
          onStep={() => {}}
          onOpenKol={() => {}}
          isSelected={() => false}
          toggleSelect={() => {}}
        />
      )}
    </>
  );
}

/** Abre o modal e entra no modo de edição. */
async function openEditing(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "open kol" }));
  await user.click(await screen.findByRole("button", { name: "Edit" }));
  return await screen.findByRole("textbox", { name: /kol notes/i });
}

const save = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Save change" }));

beforeEach(() => {
  vi.clearAllMocks();
  server.reset();
  wireApi();
  vi.mocked(fileToAvatar).mockResolvedValue(AVATAR_DATA_URL);
});

describe("KolProfileModal — salvar edições da conta", () => {
  it("manda no PATCH só o que mudou", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    await user.clear(notes);
    await user.type(notes, "nota nova");
    await save(user);

    await waitFor(() => expect(api.patchKolOverride).toHaveBeenCalledTimes(1));
    // Chave ausente = "não mexe" no backend; mandar o resto sobrescreveria
    // campos que o usuário não tocou.
    expect(api.patchKolOverride).toHaveBeenCalledWith("k1", { notes: "nota nova" });
  });

  it("mostra a nota salva ao reabrir o modal, sem recarregar a página", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    await user.clear(notes);
    await user.type(notes, "nota nova");
    await save(user);
    await waitFor(() => expect(api.patchKolOverride).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Close" }));

    // Regressão: `invalidate` só derrubava a listagem; o detalhe (`["kol", id]`)
    // continuava no cache com o estado anterior ao PATCH — reabrir mostrava a
    // versão velha e só o F5 corrigia.
    await user.click(screen.getByRole("button", { name: "open kol" }));
    expect(await screen.findByText("nota nova")).toBeInTheDocument();
    expect(screen.queryByText("nota antiga")).toBeNull();
  });

  it("salva todos os campos do KOL e os devolve iguais ao reabrir", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);

    await user.clear(notes);
    await user.type(notes, "nota nova");

    await user.clear(screen.getByRole("textbox", { name: /twitter/i }));
    await user.type(screen.getByRole("textbox", { name: /twitter/i }), "@handlenovo");

    // Nível: grava a relevância no meio da faixa escolhida.
    await user.click(screen.getByRole("button", { name: "Tier Bronze" }));

    // Tipos: troca Alpha Caller por Whale.
    await user.click(screen.getByRole("button", { name: "Alpha Caller" }));
    await user.click(screen.getByRole("button", { name: "Whale" }));

    // Squads: tira o da conta e põe outro que ele já usa em outro KOL.
    await user.click(screen.getByRole("button", { name: "Meu FnF" }));
    await user.click(screen.getByRole("button", { name: "Outro Squad" }));

    // Carteiras: remove a que veio do preset e adiciona outra.
    await user.click(screen.getByRole("button", { name: "Remove wallet main" }));
    await user.type(screen.getByRole("textbox", { name: /wallet nickname/i }), "cold");
    await user.type(
      screen.getByRole("textbox", { name: /wallet address/i }),
      "So1ana222",
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    await save(user);

    await waitFor(() => expect(api.patchKolOverride).toHaveBeenCalledTimes(1));
    expect(api.patchKolOverride).toHaveBeenCalledWith("k1", {
      notes: "nota nova",
      twitter: "handlenovo",
      relevance: 19,
      types: ["whale"],
      // Só os squads DA CONTA sobem: "Lair" é do preset e não é do usuário.
      squads: ["Outro Squad"],
      wallets: [{ name: "cold", address: "So1ana222" }],
    });

    // Reabre e confere que a UI parte do estado do servidor, não do cache velho.
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "open kol" }));

    expect(await screen.findByText("nota nova")).toBeInTheDocument();
    expect(screen.getByText("@handlenovo")).toBeInTheDocument();
    expect(screen.getByText("Bronze")).toBeInTheDocument();
    expect(screen.getByText("Whale")).toBeInTheDocument();
    expect(screen.getByText("So1ana222")).toBeInTheDocument();
    expect(screen.queryByText("So1ana111")).toBeNull();
  });

  it("troca a foto e depois a limpa com a convenção do backend", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    await user.upload(
      document.querySelector<HTMLInputElement>('input[type="file"]')!,
      new File(["x"], "foto.png", { type: "image/png" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save change" })).toBeEnabled(),
    );
    await save(user);

    await waitFor(() =>
      expect(api.patchKolOverride).toHaveBeenCalledWith("k1", { avatar: AVATAR_DATA_URL }),
    );
    expect(server.kol.avatar).toBe(AVATAR_DATA_URL);
  });

  it("põe o KOL num squad novo, digitado na hora", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    await user.type(screen.getByRole("textbox", { name: /new squad/i }), "Squad X");
    await user.click(screen.getByRole("button", { name: "Add squad" }));

    // Squad não é entidade: nasce junto com o PATCH do KOL, sem chamada própria.
    await save(user);

    await waitFor(() =>
      expect(api.patchKolOverride).toHaveBeenCalledWith("k1", {
        squads: ["Meu FnF", "Squad X"],
      }),
    );
  });
});

describe("KolProfileModal — squads", () => {
  it("lista os squads sob o nome separados por vírgula", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole("button", { name: "open kol" }));
    // Preset + conta na mesma linha, na ordem: "Squad1, Squad2, Squad3".
    expect(await screen.findByText("Lair, Meu FnF")).toBeInTheDocument();
  });

  it("acompanha o rascunho — o cabeçalho muda antes de salvar", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    await user.click(screen.getByRole("button", { name: "Outro Squad" }));

    expect(screen.getByText("Lair, Meu FnF, Outro Squad")).toBeInTheDocument();
  });

  it("não deixa o usuário tirar um squad do preset", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    // "Lair" é global: aparece como etiqueta, não como chip clicável.
    expect(screen.queryByRole("button", { name: "Lair" })).toBeNull();
    expect(screen.getByTitle("Preset squad — applies to all users")).toHaveTextContent(
      "Lair",
    );
  });

  it("ignora squad repetido, com outra caixa ou só espaços", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    const input = screen.getByRole("textbox", { name: /new squad/i });

    for (const attempt of ["  lair  ", "MEU FNF", "   "]) {
      await user.clear(input);
      await user.type(input, attempt);
      await user.click(screen.getByRole("button", { name: "Add squad" }));
    }

    expect(screen.getByText("Lair, Meu FnF")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save change" })).toBeDisabled();
  });

  it("sem squad nenhum, diz isso em vez de deixar a linha vazia", async () => {
    const user = userEvent.setup();
    server.kol.squads = [];
    server.kol.ownSquads = [];
    renderWithQuery(<Harness />);

    await user.click(screen.getByRole("button", { name: "open kol" }));
    expect(await screen.findByText("No squad")).toBeInTheDocument();
  });
});

describe("KolProfileModal — rascunho", () => {
  it("mantém Salvar desabilitado enquanto nada mudou", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    await openEditing(user);
    expect(screen.getByRole("button", { name: "Save change" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
  });

  it("Descartar volta ao estado carregado do servidor", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    await user.clear(notes);
    await user.type(notes, "rascunho");
    expect(notes).toHaveValue("rascunho");

    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(notes).toHaveValue("nota antiga");
    expect(api.patchKolOverride).not.toHaveBeenCalled();
  });

  it("pede confirmação antes de fechar com alterações não salvas", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    await user.type(notes, " editado");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(confirm).toHaveBeenCalled();
    // Recusou descartar → o modal continua aberto com o rascunho.
    expect(screen.getByRole("textbox", { name: /kol notes/i })).toBeInTheDocument();
  });

  it("não sobe PATCH quando o rascunho volta ao valor original", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    await user.type(notes, "x");
    await user.type(notes, "{backspace}");

    expect(screen.getByRole("button", { name: "Save change" })).toBeDisabled();
    expect(api.patchKolOverride).not.toHaveBeenCalled();
  });
});

describe("KolProfileModal — remoção", () => {
  it("esconde o KOL do preset em vez de apagá-lo", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderWithQuery(<Harness />);

    await openEditing(user);
    await user.click(screen.getByRole("button", { name: "Remove KOL" }));

    // KOL do preset é global: o usuário só o esconde na conta dele.
    await waitFor(() =>
      expect(api.patchKolOverride).toHaveBeenCalledWith("k1", { deleted: true }),
    );
    expect(api.deleteKolOverride).not.toHaveBeenCalled();
  });

  it("apaga de vez um KOL criado pelo próprio usuário", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    server.kol.isCustom = true;
    renderWithQuery(<Harness />);

    await openEditing(user);
    await user.click(screen.getByRole("button", { name: "Remove KOL" }));

    // mutationFn direto: o React Query passa (variáveis, contexto).
    await waitFor(() =>
      expect(vi.mocked(api.deleteKolOverride).mock.calls[0]?.[0]).toBe("k1"),
    );
  });
});

describe("KolProfileModal — limites da UI", () => {
  it("respeita o teto de caracteres das notas", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);

    const notes = await openEditing(user);
    expect(notes).toHaveAttribute("maxLength", "200");

    await user.clear(notes);
    fireEvent.change(notes, { target: { value: "a".repeat(30) } });
    expect(screen.getByText("30/200 caracteres")).toBeInTheDocument();
  });
});

describe("KolProfileModal — plano FREE (carteiras são do Pro)", () => {
  beforeEach(() => {
    // O servidor manda o KOL do FREE assim: sem endereços, com a contagem.
    server.kol = {
      ...server.kol,
      wallets: [],
      walletCount: 3,
      walletsLocked: true,
    };
  });

  it("mostra o convite ao Pro no lugar das carteiras e não consulta scans", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);
    await user.click(screen.getByRole("button", { name: "open kol" }));

    expect(await screen.findByText("See the 3 wallets of this KOL")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade to pro/i })).toHaveAttribute(
      "href",
      "/plans",
    );
    expect(screen.queryByText("Sidewallets / Copytraders")).not.toBeInTheDocument();
    // Scans são rota Pro (403 no FREE): nem a lista nem os do KOL são pedidos.
    expect(vi.mocked(useScans)).toHaveBeenLastCalledWith(false);
    expect(vi.mocked(useKolScans)).toHaveBeenLastCalledWith(null);
  });

  it("no modo edição não oferece adicionar carteira, e o Salvar não manda `wallets`", async () => {
    const user = userEvent.setup();
    renderWithQuery(<Harness />);
    const notes = await openEditing(user);

    expect(screen.queryByRole("textbox", { name: "Wallet address" })).not.toBeInTheDocument();

    await user.clear(notes);
    await user.type(notes, "nota nova");
    await save(user);

    await waitFor(() => expect(api.patchKolOverride).toHaveBeenCalled());
    const patch = vi.mocked(api.patchKolOverride).mock.calls[0][1];
    expect(patch).toMatchObject({ notes: "nota nova" });
    expect(patch).not.toHaveProperty("wallets");
  });
});
