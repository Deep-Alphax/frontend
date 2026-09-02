"use client";

import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";

import { cn } from "@/lib/cn";
import { Modal } from "@/components/walletReader/Modal";
import type { useKolIndex } from "@/lib/walletReader/useKolIndex";
import { getKolIndex, type KolListItem } from "@/lib/api/walletReader";
import { avatarSrc, squadHue, tierFor } from "@/lib/walletReader/types";

type Index = ReturnType<typeof useKolIndex>;

/**
 * Membros de um squad, buscados NO SERVIDOR.
 *
 * Antes saíam de uma varredura de todos os KOLs em memória — o cliente não
 * carrega mais o índice inteiro, então a consulta é o próprio filtro por squad
 * que o backend já sabe fazer.
 */
function useSquadMembers(squad: string, enabled: boolean) {
  const { data } = useQuery({
    queryKey: ["kol-squad-members", squad],
    queryFn: () => getKolIndex({ squads: [squad], sort: "relevance", limit: 100 }),
    enabled,
  });
  return data?.items ?? [];
}

/**
 * Gerenciador de squads: renomear, apagar e ver quem está em cada um.
 *
 * Não há "criar squad" aqui: squad não é entidade, é um nome na lista do KOL —
 * ele passa a existir quando alguém marca um KOL nele, no modal de perfil.
 * Renomear e apagar continuam sendo do servidor porque varrem a conta inteira.
 */
export function SquadsManagerModal({
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
  const { squads, renameSquad, deleteSquad } = index;

  return (
    <Modal open={open} onClose={onClose} title="Squads" className="max-w-lg">
      <div className="flex flex-col gap-4 p-4">
        {squads.length === 0 ? (
          <p className="text-sm text-gray-11">
            Nenhum squad ainda — abra um perfil e marque o KOL num squad.
          </p>
        ) : (
          squads.map((name) => (
            <SquadRow
              key={name}
              name={name}
              open={open}
              onRename={renameSquad}
              onDelete={deleteSquad}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </div>
    </Modal>
  );
}

/** Uma linha de squad — busca os próprios membros só enquanto o modal está aberto. */
function SquadRow({
  name,
  open,
  onRename,
  onDelete,
  onOpenProfile,
}: {
  name: string;
  open: boolean;
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
  onOpenProfile: (kolId: string) => void;
}) {
  const members: KolListItem[] = useSquadMembers(name, open);

  return (
    <div className="rounded-lg border border-gray-6 bg-gray-1">
      <div className="flex items-center gap-2 border-b border-gray-6 p-2.5">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: `hsl(${squadHue(name)} 60% 55%)` }}
        />
        <input
          // `key` no valor: depois de renomear, o servidor devolve a lista nova
          // e o campo precisa renascer com ela (defaultValue não reage sozinho).
          key={name}
          defaultValue={name}
          aria-label={`Nome do squad ${name}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== name) onRename(name, v);
            else e.target.value = name;
          }}
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-gray-12 outline-none hover:border-gray-6 focus:border-secundaria-11/60 focus:bg-gray-2"
        />
        <span className="shrink-0 text-xs text-gray-11">
          {members.length} kol{members.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => onDelete(name)}
          className="shrink-0 rounded-md p-1 text-gray-11 transition-colors hover:bg-vermelho-3 hover:text-vermelho-11"
          aria-label={`Apagar squad ${name}`}
        >
          <Trash2 className="size-4" strokeWidth={1.75} />
        </button>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {members.length === 0 ? (
          <p className="px-1 py-1 text-xs text-gray-11">
            Nenhum KOL neste squad — abra um perfil e marque em &quot;Squads&quot;.
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
                <img
                  src={avatarSrc(m)}
                  alt=""
                  width={24}
                  height={24}
                  className="size-6 rounded-full border border-gray-6 object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-12">{m.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium",
                    tier.chipBg,
                    tier.chipBorder,
                    tier.text,
                  )}
                >
                  {tier.label}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
