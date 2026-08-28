"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ChevronLeft, ChevronRight, Copy, Check, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/cn";
import { Modal } from "@/components/walletReader/Modal";
import { SidewalletBlock } from "@/components/walletReader/SidewalletBlock";
import type { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { getKol, type KolOverridePatch } from "@/lib/api/walletReader";
import { useScan, useScans } from "@/lib/walletReader/useScans";
import { fileToAvatar } from "@/lib/walletReader/avatar";
import {
  KOL_TYPES,
  memeAvatarFor,
  tierFor,
  type KolState,
  type WalletRef,
} from "@/lib/walletReader/types";

/**
 * Rascunho do modal: tudo que o botão "Salvar alterações" manda de uma vez.
 *
 * As edições ficam locais até o Salvar — antes cada tecla/clique virava um
 * PATCH. Um KOL editado por inteiro agora custa UMA requisição em vez de uma
 * por campo, e o usuário controla quando aquilo passa a valer.
 */
interface Draft {
  name: string;
  twitter: string;
  notes: string;
  relevance: number;
  types: string[];
  fnfGroups: string[];
  /** Avatar EFETIVO exibido; `null` = sem foto própria (cai no avatar por hash). */
  avatar: string | null;
  wallets: WalletRef[];
  dismissed: string[];
}

function draftFrom(state: KolState): Draft {
  return {
    name: state.name,
    twitter: state.twitter.replace(/^@/, ""),
    notes: state.notes,
    relevance: state.relevance,
    types: state.types,
    fnfGroups: state.fnfGroups,
    avatar: state.avatar,
    wallets: state.wallets,
    dismissed: state.dismissedSidewallets,
  };
}

/** Assinatura estável (listas ordenadas) p/ comparar rascunho × original. */
function fingerprint(d: Draft): string {
  return JSON.stringify({
    name: d.name.trim(),
    twitter: d.twitter.trim().replace(/^@/, ""),
    notes: d.notes,
    relevance: d.relevance,
    avatar: d.avatar,
    types: [...d.types].sort(),
    fnfGroups: [...d.fnfGroups].sort(),
    dismissed: [...d.dismissed].sort(),
    wallets: d.wallets.map((w) => `${w.name}|${w.address}`).sort(),
  });
}

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

type Index = ReturnType<typeof useKolIndex>;

/** Rótulo de seção do modal. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-6 px-4 py-4 first:border-t-0">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-11">{label}</p>
      {children}
    </div>
  );
}

/** Linha de carteira: seleção (clique), copiar, remover. */
function WalletRow({
  name,
  address,
  selected,
  onToggle,
  onRemove,
}: {
  name: string;
  address: string;
  selected: boolean;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(address).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1100);
      },
      () => {},
    );
  };
  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onToggle();
      }}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors",
        selected ? "border-principal-8 bg-principal-3/40" : "border-gray-6 bg-gray-1 hover:border-gray-8",
      )}
    >
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border text-[10px]",
          selected ? "border-principal-8 bg-principal-9 text-gray-1" : "border-gray-7 text-transparent",
        )}
      >
        ✓
      </span>
      <span className="w-20 shrink-0 truncate text-sm text-gray-12" title={name}>
        {name}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-gray-11" title={address}>
        {address}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md p-1 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
        aria-label="Copiar endereço"
      >
        {copied ? <Check className="size-4 text-green-11" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-md p-1 text-gray-11 transition-colors hover:bg-vermelho-3 hover:text-vermelho-11"
        aria-label="Remover carteira"
      >
        <Trash2 className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}

interface KolProfileModalProps {
  id: string;
  index: Index;
  onClose: () => void;
  onStep: (dir: 1 | -1) => void;
  onOpenKol: (id: string) => void;
  isSelected: (kolId: string, address: string) => boolean;
  toggleSelect: (
    kolId: string,
    w: { name: string; address: string },
    squads?: string[],
  ) => void;
}

/**
 * Busca o KOL COMPLETO (com as carteiras) e só então monta o formulário.
 *
 * A listagem não traz mais as carteiras — carregar os endereços de 60 KOLs para
 * exibir uma contagem era metade do payload da página.
 */
export function KolProfileModal(props: KolProfileModalProps) {
  const { data: state } = useQuery({
    queryKey: ["kol", props.id],
    queryFn: () => getKol(props.id),
  });

  if (!state) {
    return (
      <Modal open onClose={props.onClose} title="Carregando…">
        <div className="h-64 animate-pulse bg-gray-2" aria-hidden />
      </Modal>
    );
  }
  // `key` reinicia o rascunho ao trocar de KOL.
  return <KolProfileForm key={props.id} {...props} state={state} />;
}

function KolProfileForm({
  id,
  index,
  state,
  onClose,
  onStep,
  onOpenKol,
  isSelected,
  toggleSelect,
}: KolProfileModalProps & { state: KolState }) {
  const { patchOverride, removeKol, groups, createGroup } = index;
  const { runScan } = useScans();
  const scan = useScan(id);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState(false);

  // O modal remonta a cada KOL (`key={openId}` na tela), então o rascunho nasce
  // do estado efetivo uma única vez — edição em curso não é atropelada por
  // atualização de cache vinda do servidor.
  const [initial, setInitial] = useState<Draft>(() => draftFrom(state));
  const [draft, setDraft] = useState<Draft>(initial);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const dirty = useMemo(
    () => fingerprint(draft) !== fingerprint(initial),
    [draft, initial],
  );

  const tier = tierFor(draft.relevance);
  const twHandle = draft.twitter.trim().replace(/^@/, "");

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      set("avatar", await fileToAvatar(file));
    } catch {
      toast.error("Não foi possível ler a imagem.");
    }
  };

  /** Só os campos que mudaram — o backend trata chave ausente como "não mexe". */
  const buildPatch = (): KolOverridePatch => {
    const patch: KolOverridePatch = {};
    const name = draft.name.trim();
    if (name && name !== initial.name) patch.name = name;
    if (twHandle !== initial.twitter) patch.twitter = twHandle;
    if (draft.notes !== initial.notes) patch.notes = draft.notes;
    if (draft.relevance !== initial.relevance) patch.relevance = draft.relevance;
    if (!sameList(draft.types, initial.types)) patch.types = draft.types;
    if (!sameList(draft.fnfGroups, initial.fnfGroups)) patch.fnfGroups = draft.fnfGroups;
    if (!sameList(draft.dismissed, initial.dismissed)) {
      patch.dismissedSidewallets = draft.dismissed;
    }
    // `""` diz ao backend "limpei a foto"; `null` ali significaria herdar o preset.
    if (draft.avatar !== initial.avatar) patch.avatar = draft.avatar ?? "";

    const walletKeys = (ws: WalletRef[]) => ws.map((w) => `${w.name}|${w.address}`);
    if (!sameList(walletKeys(draft.wallets), walletKeys(initial.wallets))) {
      // Manda a lista EFETIVA: o servidor deriva added/removed contra o preset,
      // então o cliente não precisa carregar a camada base só para isso.
      patch.wallets = draft.wallets;
    }
    return patch;
  };

  const save = async () => {
    const patch = buildPatch();
    if (!Object.keys(patch).length) return;
    setSaving(true);
    const ok = await patchOverride(id, patch);
    setSaving(false);
    // Só considera limpo se o servidor aceitou — o erro já virou toast + rollback.
    if (ok) {
      setInitial(draft);
      toast.success("Alterações salvas na sua conta.");
    }
  };

  /** Fechar/navegar com rascunho sujo perderia a edição — pergunta antes. */
  const canLeave = () =>
    !dirty || window.confirm("Você tem alterações não salvas neste KOL. Descartar?");
  const guardedClose = () => {
    if (canLeave()) onClose();
  };

  return (
    <Modal
      open
      onClose={guardedClose}
      className="max-w-xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-11">
            {dirty
              ? "Alterações não salvas."
              : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => setDraft(initial)}
              className="rounded-lg border border-gray-6 bg-gray-3 px-3 py-2 text-sm font-medium text-gray-11 transition-colors hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="rounded-lg bg-principal-9 px-4 py-2 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      }
      title={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => canLeave() && onStep(-1)}
            aria-label="Anterior"
            className="flex size-7 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => canLeave() && onStep(1)}
            aria-label="Próximo"
            className="flex size-7 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
          <span className="ml-1 truncate">{draft.name}</span>
        </div>
      }
    >
      {/* Cabeçalho: avatar + nome */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={draft.avatar || memeAvatarFor(id)} alt="" width={56} height={56} className="size-14 rounded-full border border-gray-6 object-cover" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-gray-6 bg-gray-3 text-gray-11 hover:text-gray-12"
            aria-label="Enviar foto"
          >
            <Upload className="size-3" strokeWidth={2} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              onUpload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            aria-label="Nome do KOL"
            className="w-full rounded-md border border-transparent bg-transparent text-lg font-semibold text-gray-12 outline-none hover:border-gray-6 focus:border-secundaria-11/60 focus:bg-gray-1"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", tier.chipBg, tier.chipBorder, tier.text)}>
              {tier.label}
            </span>
            <span className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
              {draft.wallets.length} carteira{draft.wallets.length !== 1 ? "s" : ""}
            </span>
            {state.isCustom && (
              <span className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">criado manualmente</span>
            )}
            {draft.avatar && (
              <button
                type="button"
                onClick={() => set("avatar", null)}
                className="text-xs text-gray-11 underline underline-offset-2 hover:text-gray-12"
              >
                remover foto
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Twitter */}
      <Section label="Twitter / X">
        <div className="flex items-center gap-2">
          <input
            value={draft.twitter}
            onChange={(e) => set("twitter", e.target.value)}
            placeholder="@handle (nada aqui é verificado)"
            aria-label="Twitter / X do KOL"
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
          {twHandle && (
            <a
              href={`https://x.com/${encodeURIComponent(twHandle)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm text-secundaria-11 underline underline-offset-2 hover:text-secundaria-12"
            >
              abrir perfil
            </a>
          )}
        </div>
      </Section>

      {/* Relevância */}
      <Section label="Relevância">
        <div className="flex items-center gap-4">
          <span className={cn("w-10 shrink-0 text-2xl font-semibold tabular-nums", tier.text)}>{draft.relevance}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={draft.relevance}
            onChange={(e) => set("relevance", Number(e.target.value))}
            className="h-2 w-full cursor-pointer accent-principal-9"
          />
        </div>
        <p className="mt-2 text-xs text-gray-11">
          {state.isCustom
            ? "KOL criado manualmente — sem sugestão automática, ajuste como preferir."
            : `Sugestão automática: ${state.seedRelevance}/100 (a partir das carteiras rastreadas${state.squads.length ? " + squad " + state.squads.join(", ") : ""}). Ajuste livremente.`}
        </p>
      </Section>

      {/* Tipos */}
      <Section label="Tipo de trader">
        <div className="flex flex-wrap gap-2">
          {KOL_TYPES.map((t) => {
            const on = draft.types.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const next = new Set(draft.types);
                  if (next.has(t.id)) next.delete(t.id);
                  else next.add(t.id);
                  set("types", Array.from(next));
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-principal-8 bg-principal-3 text-principal-11" : "border-gray-6 text-gray-11 hover:border-gray-8 hover:text-gray-12",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Grupos / FnFs */}
      <Section label="Grupos / FnFs">
        {groups.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = draft.fnfGroups.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    const next = new Set(draft.fnfGroups);
                    if (next.has(g.id)) next.delete(g.id);
                    else next.add(g.id);
                    set("fnfGroups", Array.from(next));
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    on ? "border-violeta-7 bg-violeta-3 text-violeta-11" : "border-gray-6 text-gray-11 hover:border-gray-8 hover:text-gray-12",
                  )}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="novo grupo/FnF (ex: FnF do Cupsey)"
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
          <button
            type="button"
            onClick={async () => {
              const n = newGroup.trim();
              if (!n) return;
              // O grupo em si é uma entidade da conta: nasce no servidor na hora
              // (precisa de id). Marcar o KOL nele é que entra no rascunho.
              const g = await createGroup(n);
              if (!g) return;
              set("fnfGroups", Array.from(new Set(draft.fnfGroups).add(g.id)));
              setNewGroup("");
            }}
            className="h-9 shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            Criar e marcar
          </button>
        </div>
      </Section>

      {state.squads.length > 0 && (
        <Section label="Squad de origem">
          <div className="flex flex-wrap gap-2">
            {state.squads.map((s) => (
              <span key={s} className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
                {s}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Carteiras */}
      <Section label={`Carteiras (${draft.wallets.length})`}>
        <div className="flex flex-col gap-1.5">
          {draft.wallets.length === 0 && (
            <p className="text-xs text-gray-11">Nenhuma carteira ainda — adicione uma abaixo.</p>
          )}
          {draft.wallets.map((w) => (
            <WalletRow
              key={w.address}
              name={w.name}
              address={w.address}
              selected={isSelected(id, w.address)}
              onToggle={() => toggleSelect(id, w, state.squads)}
              onRemove={() => set("wallets", draft.wallets.filter((x) => x.address !== w.address))}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={wName}
            onChange={(e) => setWName(e.target.value)}
            placeholder="apelido"
            className="h-9 w-24 shrink-0 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
          <input
            value={wAddr}
            onChange={(e) => setWAddr(e.target.value)}
            placeholder="endereço da carteira"
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-1 px-3 font-mono text-xs text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
          />
          <button
            type="button"
            onClick={() => {
              const addr = wAddr.trim();
              if (!addr || draft.wallets.some((w) => w.address === addr)) return;
              set("wallets", draft.wallets.concat([{ name: wName.trim() || "Carteira", address: addr }]));
              setWName("");
              setWAddr("");
            }}
            className="h-9 shrink-0 rounded-lg border border-gray-6 bg-gray-3 px-3 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            Adicionar
          </button>
        </div>
      </Section>

      {/* Sidewallets / Copytraders */}
      <Section label="Sidewallets / Copytraders">
        <SidewalletBlock
          scan={scan ?? undefined}
          dismissed={draft.dismissed}
          onDismiss={(address) => set("dismissed", draft.dismissed.concat([address]))}
          onRun={async () => {
            await runScan(id);
          }}
          onOpenKol={onOpenKol}
        />
      </Section>

      {/* Notas */}
      <Section label="Notas">
        <textarea
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="ex: costuma comprar cedo em runners de baixo mcap…"
          aria-label="Notas do KOL"
          className="w-full resize-y rounded-lg border border-gray-6 bg-gray-1 p-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
        />
      </Section>

      {/* Remover */}
      <Section label="Remover">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-vermelho-7 bg-vermelho-2 p-3">
          <span className="text-xs text-gray-11">Remove este KOL do índice.</span>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Remover este KOL da sua coleção?")) return;
              removeKol(id, state.isCustom);
              onClose();
            }}
            className="shrink-0 rounded-lg border border-vermelho-7 bg-vermelho-3 px-3 py-1.5 text-sm font-semibold text-vermelho-11 transition-colors hover:bg-vermelho-4"
          >
            Remover KOL
          </button>
        </div>
      </Section>
    </Modal>
  );
}
