"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Camera, Check, ChevronLeft, ChevronRight, Copy, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Modal } from "@/components/walletReader/Modal";
import { SidewalletBlock } from "@/components/walletReader/SidewalletBlock";
import { TierPill, XIcon } from "@/components/walletReader/KolCard";
import type { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { getKol, type KolOverridePatch } from "@/lib/api/walletReader";
import { useKolScans, useScans } from "@/lib/walletReader/useScans";
import { fileToAvatar } from "@/lib/walletReader/avatar";
import {
  KOL_TIERS,
  KOL_TYPES,
  KOL_TYPE_MAP,
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

/**
 * Teto de caracteres das notas mostrado no contador (node 901:20221). É só da
 * UI — o backend aceita 4000, então uma nota herdada mais longa não é cortada:
 * o contador fica vermelho e o `maxLength` só barra texto NOVO.
 */
const NOTES_MAX = 200;

const sameList = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

type Index = ReturnType<typeof useKolIndex>;

/**
 * Linha de carteira (node 901:18404 / 901:20242): apelido + endereço + copiar.
 *
 * Em DETALHES ela também marca/desmarca a carteira na seleção da tela (a barra
 * de ações em massa vive lá fora) — o desenho não tem checkbox, então o estado
 * aparece na borda. Em EDIÇÃO ganha o botão de remover, que o desenho não mostra
 * mas é o único lugar de tirar uma carteira do KOL.
 */
function WalletRow({
  name,
  address,
  selected,
  onToggle,
  onRemove,
}: {
  name: string;
  address: string;
  selected?: boolean;
  onToggle?: () => void;
  onRemove?: () => void;
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
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      aria-pressed={onToggle ? selected : undefined}
      onClick={(e) => {
        if (!onToggle || (e.target as HTMLElement).closest("button")) return;
        onToggle();
      }}
      onKeyDown={(e) => {
        if (!onToggle) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
        onToggle && "cursor-pointer",
        selected ? "border-principal-8 bg-principal-3/40" : "border-gray-6 hover:border-gray-8",
      )}
    >
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <span className="w-22 shrink-0 truncate font-semibold leading-[1.1] text-gray-12" title={name}>
          {name}
        </span>
        <span className="min-w-0 truncate leading-[1.3] text-gray-11" title={address}>
          {address}
        </span>
      </div>
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar endereço"
          className="flex size-8 items-center justify-center rounded text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
        >
          {copied ? (
            <Check className="size-5 text-green-11" strokeWidth={2} />
          ) : (
            <Copy className="size-5" strokeWidth={1.75} />
          )}
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover carteira ${name}`}
            className="flex size-8 items-center justify-center rounded text-gray-11 transition-colors hover:bg-vermelho-3 hover:text-vermelho-11"
          >
            <Trash2 className="size-5" strokeWidth={1.75} />
          </button>
        )}
      </div>
    </div>
  );
}

/** Seção do corpo do modal: rótulo à esquerda + contagem opcional à direita. */
function EditSection({
  label,
  count,
  last = false,
  children,
}: {
  label: string;
  count?: string;
  /** Última seção da coluna — sem divisória embaixo. */
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("flex flex-col gap-4 px-4 py-5", !last && "border-b border-gray-6")}>
      <div className="flex items-center justify-between text-sm leading-[1.3] text-gray-11">
        <p>{label}</p>
        {count && <p className="tabular-nums">{count}</p>}
      </div>
      {children}
    </section>
  );
}

/** Chip de escolha (tipo de trader, grupo/FnF) — node 901:20227/20228. */
function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-[32px] border p-2 text-xs font-medium leading-[1.3] transition-colors",
        selected
          ? "border-secundaria-6 bg-secundaria-2 text-secundaria-11"
          : "border-gray-6 bg-gray-3 text-gray-11 hover:text-gray-12",
      )}
    >
      {label}
    </button>
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
  const scans = useKolScans(id);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [saving, setSaving] = useState(false);
  // O modal abre em DETALHES (node 901:18345); "Editar" leva ao formulário.
  const [editing, setEditing] = useState(false);

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

  /**
   * Sidebar da identidade — igual nos dois modos (nodes 901:18354 / 901:20166).
   * Em EDIÇÃO ganha o selo da câmera no avatar, o seletor de nível e o campo do
   * Twitter no lugar do link.
   */
  const sidebar = (
    <aside className="flex w-full shrink-0 flex-col overflow-y-auto border-b border-gray-6 md:w-[280px] md:self-stretch md:border-b-0 md:border-r">
      {/* Fundo do nível: mesmo degradê do card (a cor vem toda do tier). */}
      <div className={cn("relative flex flex-col items-center gap-6 px-4 py-6", tier.card)}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[321px] overflow-hidden [mask-image:linear-gradient(to_bottom,#000_0%,rgba(0,0,0,0.8)_24%,transparent_100%)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tier.emblem}
            alt=""
            width={172}
            height={172}
            className="absolute -left-8 -top-12 size-[172px] rotate-[18.79deg] object-contain opacity-50"
          />
        </div>

        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.avatar || memeAvatarFor(id)}
            alt=""
            width={96}
            height={96}
            className={cn("size-24 rounded-full border-2 object-cover", tier.ring)}
          />
          {editing && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Trocar foto"
                className="absolute -bottom-0.5 -right-0.5 flex size-7 items-center justify-center rounded-[14px] border border-violeta-8 bg-gray-3 text-gray-11 transition-colors hover:text-gray-12"
              >
                <Camera className="size-4" strokeWidth={1.75} />
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
            </>
          )}
        </div>

        <div className="relative flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-semibold leading-[1.1] text-gray-12">{draft.name}</p>
          <p className="text-sm font-medium leading-[1.3] text-gray-11">
            {state.squads.length > 0 ? state.squads.join(" · ") : "Sem squad"}
          </p>
        </div>

        <div className="relative flex w-full flex-col items-center gap-4">
          <TierPill tier={tier} />
          {draft.types.length > 0 && (
            <div className="flex flex-wrap items-start justify-center gap-1.5">
              {draft.types.map((tid) => (
                <span
                  key={tid}
                  className="rounded-[32px] border border-gray-6 bg-gray-3 p-2 text-xs font-medium leading-[1.3] text-gray-11"
                >
                  {KOL_TYPE_MAP[tid]?.label ?? tid}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Barra de 2px do nível — sempre cheia, no degradê do tier (node 901:18376). */}
      <div className={cn("h-0.5 w-full shrink-0 rounded-[32px] bg-linear-to-r", tier.bar)} />

      {editing && (
        <div className="flex flex-col gap-4 border-b border-gray-6 px-4 py-5">
          <p className="text-sm leading-[1.3] text-gray-11">Nível deste usuário</p>
          <div className="flex flex-wrap gap-2">
            {KOL_TIERS.slice().reverse().map((t) => {
              const on = t.id === tier.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Nível ${t.label}`}
                  // Escolher o nível grava a relevância no MEIO da faixa; se já
                  // está dentro dela, o valor fino do usuário é preservado.
                  onClick={() =>
                    set(
                      "relevance",
                      draft.relevance >= t.min && draft.relevance <= t.max
                        ? draft.relevance
                        : Math.round((t.min + t.max) / 2),
                    )
                  }
                  className={cn(
                    "rounded-[32px] transition-opacity",
                    on ? "opacity-100" : "opacity-45 hover:opacity-80",
                  )}
                >
                  <TierPill tier={t} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 p-4">
        <p className="text-base leading-[1.3] text-gray-12">Twitter</p>
        {editing ? (
          <div className="flex h-11 items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 px-3">
            <XIcon className="size-4 shrink-0 text-gray-11" />
            <input
              value={draft.twitter}
              onChange={(e) => set("twitter", e.target.value)}
              placeholder="@handle"
              aria-label="Twitter / X do KOL"
              className="min-w-0 flex-1 bg-transparent text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11"
            />
          </div>
        ) : twHandle ? (
          <a
            href={`https://x.com/${encodeURIComponent(twHandle)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm leading-[1.3] text-gray-11 transition-colors hover:text-gray-12"
          >
            <XIcon className="size-4 shrink-0" />
            <span className="min-w-0 truncate">@{twHandle}</span>
          </a>
        ) : (
          <p className="text-sm leading-[1.3] text-gray-11">Sem Twitter cadastrado.</p>
        )}
      </div>
    </aside>
  );

  /** Bloco da varredura — igual nos dois modos (node 901:18413 / 901:20251). */
  const sidewallets = (
    <div className="rounded-xl border border-gray-6 bg-gray-1/60 p-4">
      <SidewalletBlock
        wallets={draft.wallets}
        scans={scans}
        dismissed={draft.dismissed}
        onDismiss={(address) => set("dismissed", draft.dismissed.concat([address]))}
        onRun={async (address) => {
          await runScan(id, address);
        }}
        onOpenKol={onOpenKol}
      />
    </div>
  );

  /** Coluna central do modo DETALHES (node 901:18393). */
  const mainView = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <div className="flex flex-col gap-3 border-b border-gray-6 px-4 py-5">
        <p className="text-sm leading-[1.3] text-gray-11">Sobre este trader</p>
        <p className="whitespace-pre-wrap text-base leading-[1.3] text-gray-12">
          {draft.notes.trim() || "Sem notas ainda — use Editar para escrever."}
        </p>
      </div>

      <EditSection label="Carteiras" count={`${draft.wallets.length} no total`}>
        {draft.wallets.length === 0 ? (
          <p className="text-sm text-gray-11">Nenhuma carteira cadastrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {draft.wallets.map((w) => (
              <WalletRow
                key={w.address}
                name={w.name}
                address={w.address}
                selected={isSelected(id, w.address)}
                onToggle={() => toggleSelect(id, w, state.squads)}
              />
            ))}
          </div>
        )}
      </EditSection>

      <EditSection label="Sidewallets / Copytraders" last>
        {sidewallets}
      </EditSection>
    </div>
  );

  /** Coluna central do modo EDIÇÃO (node 901:20216). */
  const mainEdit = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
      <section className="flex flex-col gap-2 border-b border-gray-6 px-4 py-5">
        <p className="text-base leading-[1.3] text-gray-12">Notas</p>
        <textarea
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={NOTES_MAX}
          rows={5}
          placeholder="Ex: Costuma comprar cedo em runner de baixo mcap…"
          aria-label="Notas do KOL"
          className="w-full resize-y rounded-lg border border-gray-6 bg-gray-2 px-3 py-4 text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11 focus:border-secundaria-11/60"
        />
        <p
          className={cn(
            "text-right text-sm leading-[1.3] tabular-nums",
            draft.notes.length > NOTES_MAX ? "text-vermelho-11" : "text-gray-11",
          )}
        >
          {draft.notes.length}/{NOTES_MAX} caracteres
        </p>
      </section>

      <EditSection label="Tipo de trader" count={`${draft.types.length} no total`}>
        <div className="flex flex-wrap gap-2">
          {KOL_TYPES.map((t) => (
            <ChoiceChip
              key={t.id}
              label={t.label}
              selected={draft.types.includes(t.id)}
              onClick={() => {
                const next = new Set(draft.types);
                if (next.has(t.id)) next.delete(t.id);
                else next.add(t.id);
                set("types", Array.from(next));
              }}
            />
          ))}
        </div>
      </EditSection>

      {/*
       * Grupos/FnFs não aparecem no node, mas ESTE é o único lugar que marca um
       * KOL num grupo (o gerenciador só lista os membros) — tirar a seção
       * quebraria o filtro de FnFs da rail. Segue a linguagem dos chips acima.
       */}
      <EditSection label="Grupos / FnFs" count={`${draft.fnfGroups.length} marcado${draft.fnfGroups.length !== 1 ? "s" : ""}`}>
        <div className="flex flex-wrap gap-2">
          {groups.map((g) => (
            <ChoiceChip
              key={g.id}
              label={g.name}
              selected={draft.fnfGroups.includes(g.id)}
              onClick={() => {
                const next = new Set(draft.fnfGroups);
                if (next.has(g.id)) next.delete(g.id);
                else next.add(g.id);
                set("fnfGroups", Array.from(next));
              }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="Novo grupo/FnF"
            aria-label="Novo grupo ou FnF"
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11 focus:border-secundaria-11/60"
          />
          <button
            type="button"
            onClick={async () => {
              const n = newGroup.trim();
              if (!n) return;
              // O grupo é entidade da conta: nasce no servidor na hora (precisa
              // de id). Marcar o KOL nele é que entra no rascunho.
              const g = await createGroup(n);
              if (!g) return;
              set("fnfGroups", Array.from(new Set(draft.fnfGroups).add(g.id)));
              setNewGroup("");
            }}
            className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-4"
          >
            Criar e marcar
          </button>
        </div>
      </EditSection>

      <EditSection label="Carteiras" count={`${draft.wallets.length} no total`}>
        {draft.wallets.length > 0 && (
          <div className="flex flex-col gap-2">
            {draft.wallets.map((w) => (
              <WalletRow
                key={w.address}
                name={w.name}
                address={w.address}
                onRemove={() =>
                  set("wallets", draft.wallets.filter((x) => x.address !== w.address))
                }
              />
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <input
            value={wName}
            onChange={(e) => setWName(e.target.value)}
            placeholder="Apelido"
            aria-label="Apelido da carteira"
            className="h-10 w-[165px] shrink-0 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11 focus:border-secundaria-11/60"
          />
          <input
            value={wAddr}
            onChange={(e) => setWAddr(e.target.value)}
            placeholder="Endereço da carteira"
            aria-label="Endereço da carteira"
            className="h-10 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm leading-[1.3] text-gray-12 outline-none placeholder:text-gray-11 focus:border-secundaria-11/60"
          />
          <button
            type="button"
            onClick={() => {
              const addr = wAddr.trim();
              if (!addr || draft.wallets.some((w) => w.address === addr)) return;
              set(
                "wallets",
                draft.wallets.concat([{ name: wName.trim() || "Carteira", address: addr }]),
              );
              setWName("");
              setWAddr("");
            }}
            className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-principal-9 px-6 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
          >
            Adicionar
          </button>
        </div>
      </EditSection>

      <EditSection label="Sidewallets / Copytraders">{sidewallets}</EditSection>

      <section className="px-4 py-5">
        <div className="flex items-center justify-between gap-4 rounded-lg border border-vermelho-5 bg-vermelho-5/10 p-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-base font-semibold leading-[1.1] text-gray-12">Remover</p>
            <p className="text-[13px] text-gray-11">
              Você perde as notas, a classificação e as carteiras vinculadas a este KOL
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Remover este KOL da sua coleção?")) return;
              removeKol(id, state.isCustom);
              onClose();
            }}
            className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-vermelho-9 px-5 text-sm font-semibold text-gray-12 transition-colors hover:bg-vermelho-10"
          >
            Remover KOL
          </button>
        </div>
      </section>
    </div>
  );

  return (
    <Modal
      open
      onClose={guardedClose}
      className="max-w-5xl rounded-2xl"
      bodyClassName="flex overflow-hidden"
      footer={
        editing ? (
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => canLeave() && setEditing(false)}
              className="mr-auto text-sm text-gray-11 underline underline-offset-2 transition-colors hover:text-gray-12"
            >
              Voltar aos detalhes
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => setDraft(initial)}
              className="flex h-12 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-5 text-base font-semibold text-gray-12 transition-colors hover:bg-gray-4 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Descartar
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={save}
              className="flex h-12 items-center justify-center rounded-lg bg-principal-9 px-5 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Salvar alteração"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            {dirty && <span className="mr-auto text-xs text-gray-11">Alterações não salvas.</span>}
            <button
              type="button"
              onClick={guardedClose}
              className="flex h-12 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 px-5 text-base font-semibold text-gray-12 transition-colors hover:bg-gray-4"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-principal-9 px-5 text-base font-semibold text-gray-1 transition-colors hover:bg-principal-10"
            >
              <Pencil className="size-5" strokeWidth={2} />
              Editar
            </button>
          </div>
        )
      }
      title={
        editing ? (
          <span className="truncate text-lg font-semibold leading-[1.1] text-gray-12">
            Editando perfil
          </span>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => canLeave() && onStep(-1)}
                aria-label="Anterior"
                className="flex size-8 items-center justify-center rounded text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
              >
                <ChevronLeft className="size-6" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => canLeave() && onStep(1)}
                aria-label="Próximo"
                className="flex size-8 items-center justify-center rounded text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
              >
                <ChevronRight className="size-6" strokeWidth={2} />
              </button>
            </div>
            <span className="truncate text-lg font-semibold leading-[1.1] text-gray-12">
              Detalhes do perfil
            </span>
          </div>
        )
      }
    >
      <div className="flex min-h-0 w-full flex-1 flex-col md:flex-row">
        {sidebar}
        {editing ? mainEdit : mainView}
      </div>
    </Modal>
  );
}
