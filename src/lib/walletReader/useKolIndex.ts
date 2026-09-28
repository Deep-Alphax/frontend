"use client";

import { useCallback, useMemo, useState } from "react";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import toast from "react-hot-toast";

import { getApiErrorMessage, isNotFoundError } from "@/lib/api/client";
import {
  createCustomKol,
  deleteKolOverride,
  deleteKolSquad,
  exportKolBackup,
  getKolIndex,
  importKolBackup,
  patchKolOverride,
  renameKolSquad,
  resetKolAccount,
  type KolIndexPage,
  type KolIndexParams,
  type KolOverridePatch,
} from "@/lib/api/walletReader";
import type { WalletRef } from "@/lib/walletReader/types";
import { chunkOverrides, type KolImportPayload } from "@/lib/walletReader/backup";

/** Raiz da chave — invalidar por ela alcança TODA combinação de filtro. */
export const KOL_INDEX_KEY = ["kol-index"] as const;
export const kolIndexKey = (p: KolIndexParams) => [...KOL_INDEX_KEY, p] as const;

/**
 * Raiz da chave do KOL individual (`getKol`, o estado efetivo COM as carteiras
 * que o modal de perfil usa para montar o rascunho).
 *
 * Chave SEPARADA da listagem, então invalidar `KOL_INDEX_KEY` não a alcança —
 * era por isso que uma edição salva só aparecia depois de um F5: a listagem
 * refazia a busca, mas o detalhe continuava servindo o snapshot de antes do
 * PATCH (`staleTime` 60s / `gcTime` 5min em `Providers`), e o rascunho do
 * formulário nasce dele UMA vez (`useState`), sem reagir a refetch posterior.
 */
export const KOL_DETAIL_KEY = ["kol"] as const;
export const kolDetailKey = (kolId: string) => [...KOL_DETAIL_KEY, kolId] as const;

/** Itens por página. O servidor devolve no máximo 200. */
const PAGE = 60;

/**
 * Índice de KOLs, paginado NO SERVIDOR.
 *
 * O merge `preset + override`, os filtros, as contagens da rail e a ordenação
 * são do backend — o cliente recebe só a página que está mostrando. Antes vinha
 * o índice inteiro (73 KB, linear no tamanho do preset) a cada carregamento.
 *
 * As mutações invalidam a raiz da chave em vez de costurar o cache: com lista
 * paginada e filtrada no servidor, remendar página por página erra fácil (um
 * item editado pode sair do filtro atual) e o custo de uma refetch é baixo.
 */
export function useKolIndex(params: KolIndexParams) {
  const qc = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: kolIndexKey(params),
    queryFn: ({ pageParam }) =>
      getKolIndex({ ...params, offset: pageParam, limit: PAGE }),
    initialPageParam: 0,
    getNextPageParam: (last: KolIndexPage, all: KolIndexPage[]) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    // Cada combinação de filtro é uma chave nova: sem isto, marcar um filtro
    // deixava a query sem dados até a resposta chegar — a grade virava
    // esqueleto e TODAS as contagens da rail caíam para 0. Com o dado anterior
    // mantido, a tela só troca quando o novo chega (`refreshing` no meio).
    placeholderData: keepPreviousData,
  });

  const pages = useMemo(() => query.data?.pages ?? [], [query.data]);
  /** A 1ª página carrega as facetas — elas valem para a consulta inteira. */
  const head = pages[0];

  // Dedup por id: paginação por offset pode repetir um item se a ordenação
  // empatar entre páginas (mesmo cuidado do feed do Radar).
  const items = useMemo(() => {
    const seen = new Set<string>();
    return pages
      .flatMap((p) => p.items)
      .filter((it) => (seen.has(it.id) ? false : (seen.add(it.id), true)));
  }, [pages]);

  /**
   * Toda escrita derruba as DUAS camadas de cache: a listagem paginada e o
   * detalhe de cada KOL. Invalidar só a listagem deixava o modal reabrir com o
   * estado anterior ao PATCH — o usuário via a edição sumir e recorria ao F5.
   */
  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: KOL_INDEX_KEY }),
      qc.invalidateQueries({ queryKey: KOL_DETAIL_KEY }),
    ]);
  }, [qc]);

  const onError = useCallback(
    (error: unknown, fallback: string) => {
      if (isNotFoundError(error)) {
        void invalidate();
        toast.error("This KOL no longer exists. The list has been refreshed.");
        return;
      }
      toast.error(getApiErrorMessage(error, fallback));
    },
    [invalidate],
  );

  const patchMut = useMutation({
    mutationFn: ({ kolId, patch }: { kolId: string; patch: KolOverridePatch }) =>
      patchKolOverride(kolId, patch),
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not save the change."),
  });

  /** Salva as edições da conta. `true` = o servidor aceitou. */
  const patchOverride = useCallback(
    (id: string, patch: KolOverridePatch): Promise<boolean> =>
      patchMut
        .mutateAsync({ kolId: id, patch })
        .then(() => true)
        .catch(() => false),
    [patchMut],
  );

  const addKolMut = useMutation({
    mutationFn: createCustomKol,
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not create the KOL."),
  });

  const addKol = useCallback(
    async (name: string, wallet?: WalletRef): Promise<string | null> => {
      const entry = await addKolMut.mutateAsync({ name, wallet }).catch(() => null);
      return entry?.kolId ?? null;
    },
    [addKolMut],
  );

  const removeMut = useMutation({
    mutationFn: deleteKolOverride,
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not remove the KOL."),
  });

  /**
   * Um KOL custom é do usuário e some de vez; um do preset só é escondido —
   * o preset é global e não é ele quem manda nele.
   */
  const removeKol = useCallback(
    (id: string, isCustom: boolean) => {
      if (isCustom) removeMut.mutate(id);
      else void patchOverride(id, { deleted: true });
    },
    [removeMut, patchOverride],
  );

  // ── Squads da conta ────────────────────────────────────────────────────────
  //
  // Não há "criar squad": marcar um KOL num squad é um PATCH nele (o nome passa
  // a existir por consequência). Só renomear e apagar precisam varrer a conta,
  // e isso o servidor faz numa requisição.

  const renameSquadMut = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => renameKolSquad(from, to),
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not rename the squad."),
  });

  const deleteSquadMut = useMutation({
    mutationFn: deleteKolSquad,
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not remove the squad."),
  });

  // ── Backup da conta ────────────────────────────────────────────────────────

  /**
   * Restaura um backup JÁ normalizado (`parseKolBackup`), em lotes que caibam
   * no corpo do servidor. Os lotes vão em sequência — em paralelo, um backup
   * grande viraria uma rajada contra o rate limit. O import é upsert por
   * (conta, kolId), então um lote que falhou pode ser reenviado sem duplicar.
   *
   * `groups` (backup antigo) viaja em TODO lote: é a tabela que traduz os
   * `fnfGroups` daquele lote, e o servidor não guarda estado entre chamadas.
   */
  const [importing, setImporting] = useState(false);
  const importBackup = useCallback(
    async (payload: KolImportPayload): Promise<{ imported: number; failed: boolean }> => {
      let imported = 0;
      setImporting(true);
      try {
        for (const overrides of chunkOverrides(payload.overrides)) {
          const res = await importKolBackup({ overrides, groups: payload.groups });
          imported += res.imported;
        }
        return { imported, failed: false };
      } catch (e) {
        toast.error(
          getApiErrorMessage(
            e,
            imported
              ? `Import stopped after ${imported} KOLs. Try the same file again.`
              : "Could not import the backup.",
          ),
        );
        return { imported, failed: true };
      } finally {
        setImporting(false);
        // Mesmo com falha no meio: os lotes anteriores JÁ foram gravados.
        if (imported > 0) await invalidate();
      }
    },
    [invalidate],
  );

  const resetMut = useMutation({
    mutationFn: resetKolAccount,
    onSuccess: invalidate,
    onError: (e) => onError(e, "Could not clear the edits."),
  });

  return {
    loaded: !query.isPending,
    /** Mostrando o resultado do filtro ANTERIOR enquanto o novo carrega. */
    refreshing: query.isPlaceholderData,
    items,
    total: head?.total ?? 0,
    counts: head?.counts ?? { byTier: {}, byType: {}, bySquad: {} },
    viewCounts: head?.viewCounts ?? {},
    squads: head?.squads ?? [],
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    patchOverride,
    addKol,
    removeKol,
    renameSquad: (from: string, to: string) => renameSquadMut.mutate({ from, to }),
    deleteSquad: (name: string) => deleteSquadMut.mutate(name),
    exportBackup: exportKolBackup,
    importBackup,
    importing,
    reset: () => resetMut.mutate(),
  };
}
