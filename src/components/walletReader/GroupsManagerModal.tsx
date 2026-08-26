"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Modal } from "@/components/walletReader/Modal";
import type { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { avatarSrc, groupHue, tierFor } from "@/lib/walletReader/types";

type Index = ReturnType<typeof useKolIndex>;

/** Gerenciador de Grupos/FnFs: criar, renomear, apagar + ver membros. */
export function GroupsManagerModal({
  open,
  onClose,
  index,
  onOpenProfile,
}: {
  open: boolean;
  onClose: () => void;
  index: Index;
  onOpenProfile: (id: string) => void;
}) {
  const { groups, createGroup, renameGroup, deleteGroup, groupMembers } = index;
  const [name, setName] = useState("");

  return (
    <Modal open={open} onClose={onClose} title="Grupos / FnFs" className="max-w-lg">
      <div className="flex items-center gap-2 border-b border-gray-6 p-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) {
              createGroup(name.trim());
              setName("");
            }
          }}
          placeholder="novo grupo/FnF"
          className="h-9 min-w-0 flex-1 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 placeholder:text-gray-11 outline-none focus:border-secundaria-11/60"
        />
        <button
          type="button"
          onClick={() => {
            if (!name.trim()) return;
            createGroup(name.trim());
            setName("");
          }}
          className="h-9 shrink-0 rounded-lg bg-principal-9 px-3 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
        >
          Criar
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {groups.length === 0 && <p className="text-sm text-gray-11">Nenhum grupo/FnF criado ainda.</p>}
        {groups.map((g) => {
          const members = groupMembers(g.id);
          return (
            <div key={g.id} className="rounded-lg border border-gray-6 bg-gray-1">
              <div className="flex items-center gap-2 border-b border-gray-6 p-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: `hsl(${groupHue(g.id)} 60% 55%)` }} />
                <input
                  defaultValue={g.name}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v && v !== g.name) renameGroup(g.id, v);
                    else e.target.value = g.name;
                  }}
                  className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-gray-12 outline-none hover:border-gray-6 focus:border-secundaria-11/60 focus:bg-gray-2"
                />
                <span className="shrink-0 text-xs text-gray-11">
                  {members.length} kol{members.length !== 1 ? "s" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => deleteGroup(g.id)}
                  className="shrink-0 rounded-md p-1 text-gray-11 transition-colors hover:bg-vermelho-3 hover:text-vermelho-11"
                  aria-label="Apagar grupo"
                >
                  <Trash2 className="size-4" strokeWidth={1.75} />
                </button>
              </div>
              <div className="flex flex-col gap-1 p-2">
                {members.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-gray-11">
                    Nenhum KOL marcado — abra um perfil e marque em &quot;Grupos / FnFs&quot;.
                  </p>
                ) : (
                  members.map((m) => {
                    const tier = tierFor(m.relevance);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onOpenProfile(m.id)}
                        className="flex items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-gray-3"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarSrc(m)} alt="" width={24} height={24} className="size-6 rounded-full border border-gray-6 object-cover" />
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-12">{m.name}</span>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium", tier.chipBg, tier.chipBorder, tier.text)}>
                          {tier.label}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
