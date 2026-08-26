"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Check, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/cn";
import { Modal } from "@/components/walletReader/Modal";
import { SidewalletBlock } from "@/components/walletReader/SidewalletBlock";
import type { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { useScans } from "@/lib/walletReader/useScans";
import { KOL_TYPES, avatarSrc, tierFor } from "@/lib/walletReader/types";

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

/** Redimensiona a imagem escolhida p/ 200×200 (cover) → data URL JPEG. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        const s = Math.max(size / img.width, size / img.height);
        const w = img.width * s;
        const h = img.height * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(c.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = String(e.target?.result ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  toggleSelect: (kolId: string, w: { name: string; address: string }) => void;
}

/** Modal de perfil/edição de um KOL (node do app original, adaptado ao DS). */
export function KolProfileModal({ id, index, onClose, onStep, onOpenKol, isSelected, toggleSelect }: KolProfileModalProps) {
  const { getState, patchOverride, addWallet, removeWallet, removeKol, groups, createGroup } = index;
  const { scans, runScan } = useScans();
  const state = getState(id);
  const tier = tierFor(state.relevance);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [wName, setWName] = useState("");
  const [wAddr, setWAddr] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [relView, setRelView] = useState(state.relevance);

  const onUpload = async (file: File | undefined) => {
    if (!file) return;
    try {
      patchOverride(id, { avatar: await fileToAvatar(file) });
    } catch {
      // ignora
    }
  };

  const twHandle = state.twitter.replace(/^@/, "");

  return (
    <Modal
      open
      onClose={onClose}
      className="max-w-xl"
      title={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStep(-1)}
            aria-label="Anterior"
            className="flex size-7 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ChevronLeft className="size-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            aria-label="Próximo"
            className="flex size-7 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <ChevronRight className="size-4" strokeWidth={2} />
          </button>
          <span className="ml-1 truncate">{state.name}</span>
        </div>
      }
    >
      {/* Cabeçalho: avatar + nome */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="relative shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={avatarSrc(state)} alt="" width={56} height={56} className="size-14 rounded-full border border-gray-6 object-cover" />
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
            defaultValue={state.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== state.name) patchOverride(id, { name: v });
            }}
            className="w-full rounded-md border border-transparent bg-transparent text-lg font-semibold text-gray-12 outline-none hover:border-gray-6 focus:border-secundaria-11/60 focus:bg-gray-1"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", tier.chipBg, tier.chipBorder, tier.text)}>
              {tier.label}
            </span>
            <span className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">
              {state.walletCount} carteira{state.walletCount !== 1 ? "s" : ""}
            </span>
            {state.isCustom && (
              <span className="rounded-md border border-gray-6 px-2 py-0.5 text-xs text-gray-11">criado manualmente</span>
            )}
            {state.avatar && (
              <button
                type="button"
                onClick={() => patchOverride(id, { avatar: null })}
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
            defaultValue={twHandle}
            placeholder="@handle (nada aqui é verificado)"
            onBlur={(e) => patchOverride(id, { twitter: e.target.value.trim().replace(/^@/, "") })}
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
          <span className={cn("w-10 shrink-0 text-2xl font-semibold tabular-nums", tier.text)}>{relView}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={relView}
            onChange={(e) => setRelView(Number(e.target.value))}
            onMouseUp={() => patchOverride(id, { relevance: relView })}
            onTouchEnd={() => patchOverride(id, { relevance: relView })}
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
            const on = state.types.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const set = new Set(state.types);
                  if (set.has(t.id)) set.delete(t.id);
                  else set.add(t.id);
                  patchOverride(id, { types: Array.from(set) });
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
              const on = state.fnfGroups.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    const set = new Set(state.fnfGroups);
                    if (set.has(g.id)) set.delete(g.id);
                    else set.add(g.id);
                    patchOverride(id, { fnfGroups: Array.from(set) });
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
            onClick={() => {
              const n = newGroup.trim();
              if (!n) return;
              const g = createGroup(n);
              patchOverride(id, { fnfGroups: Array.from(new Set(state.fnfGroups).add(g.id)) });
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
      <Section label={`Carteiras (${state.wallets.length})`}>
        <div className="flex flex-col gap-1.5">
          {state.wallets.length === 0 && (
            <p className="text-xs text-gray-11">Nenhuma carteira ainda — adicione uma abaixo.</p>
          )}
          {state.wallets.map((w) => (
            <WalletRow
              key={w.address}
              name={w.name}
              address={w.address}
              selected={isSelected(id, w.address)}
              onToggle={() => toggleSelect(id, w)}
              onRemove={() => removeWallet(id, w.address)}
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
              if (!addr || state.wallets.some((w) => w.address === addr)) return;
              addWallet(id, wName.trim() || "Carteira", addr);
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
          scan={scans[id]}
          dismissed={state.dismissedSidewallets}
          onDismiss={(address) =>
            patchOverride(id, { dismissedSidewallets: state.dismissedSidewallets.concat([address]) })
          }
          onRun={async () => {
            await runScan(id);
          }}
          onOpenKol={onOpenKol}
        />
      </Section>

      {/* Notas */}
      <Section label="Notas">
        <textarea
          defaultValue={state.notes}
          rows={3}
          placeholder="ex: costuma comprar cedo em runners de baixo mcap…"
          onBlur={(e) => patchOverride(id, { notes: e.target.value })}
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
              removeKol(id);
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
