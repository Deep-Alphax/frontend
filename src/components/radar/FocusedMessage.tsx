"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { Modal } from "@/components/walletReader/Modal";
import { RadarMessageCard } from "@/components/radar/RadarMessageCard";
import { getFeedMessage } from "@/lib/api/feed";
import { isNotFoundError } from "@/lib/api/client";

/**
 * `/radar?message=<id>` — a captura que disparou um alerta, em destaque.
 *
 * É o destino do clique na notificação (sininho e push). Busca a captura por
 * id em vez de procurá-la no feed carregado: ela pode estar muito abaixo da
 * primeira página, ou num canal que não é o selecionado.
 */
export function FocusedMessage({
  onSelectAuthor,
}: {
  onSelectAuthor?: (authorTag: string, authorName: string) => void;
}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.get("message");

  const query = useQuery({
    queryKey: ["feed-message", id],
    queryFn: () => getFeedMessage(id!),
    enabled: Boolean(id),
    retry: false,
    staleTime: 5 * 60_000,
  });

  const close = () => router.replace(pathname, { scroll: false });

  // 404 = apagada, ou fora do plano (o grupo deixou de ser Free). Avisa e limpa
  // a URL em vez de deixar um modal vazio aberto.
  useEffect(() => {
    if (!query.isError) return;
    toast.error(
      isNotFoundError(query.error)
        ? "This message is no longer available."
        : "Could not open this message.",
    );
    router.replace(pathname, { scroll: false });
  }, [query.isError, query.error, pathname, router]);

  if (!id || !query.data) return null;

  return (
    <Modal open onClose={close} title="From your alert" className="max-w-xl">
      <div className="p-4">
        <RadarMessageCard
          m={query.data}
          highlighted
          onSelectAuthor={(tag, name) => {
            close();
            onSelectAuthor?.(tag, name);
          }}
        />
      </div>
    </Modal>
  );
}
