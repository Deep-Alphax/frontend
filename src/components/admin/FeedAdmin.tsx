"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFeedStatus } from "@/lib/api/feed";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";
import { MonitorsManager } from "@/components/admin/MonitorsManager";
import { BlacklistManager } from "@/components/admin/BlacklistManager";
import { FeedList } from "@/components/admin/FeedList";
import { PromoteAdmin } from "@/components/admin/PromoteAdmin";

function Pill({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return (
    <span
      className={
        "rounded-full px-3 py-1 text-xs font-medium " +
        (ok ? "bg-green-10/20 text-green-11" : "bg-gray-6/40 text-gray-11")
      }
    >
      {ok ? on : off}
    </span>
  );
}

/** Barra de status do self-bot (sempre visível, acima das abas). */
function StatusBar() {
  const statusQuery = useQuery({
    queryKey: ["feed-status"],
    queryFn: getFeedStatus,
    refetchInterval: 15_000,
  });
  const s = statusQuery.data;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pill ok={!!s?.connected} on={`Self-bot: ${s?.userTag ?? "conectado"}`} off="Self-bot: offline" />
      <Pill ok={!!s?.telegramEnabled} on="Telegram: on" off="Telegram: off" />
      {s && (
        <span className="rounded-full bg-gray-3 px-3 py-1 text-xs text-gray-11">
          {s.activeMonitors} regras · {s.watchedChannels} canais · {s.watchedGuilds} servidores
        </span>
      )}
      {s && !s.enabled && (
        <span className="text-xs text-danger-11">
          DISCORD_USER_TOKEN ausente — self-bot desligado (defina no .env e reinicie).
        </span>
      )}
    </div>
  );
}

type TabKey = "regras" | "blacklist" | "feed" | "admins";

const TABS: { key: TabKey; label: string }[] = [
  { key: "regras", label: "Regras" },
  { key: "blacklist", label: "Blacklist" },
  { key: "feed", label: "Feed" },
  { key: "admins", label: "Admins" },
];

/**
 * Tela de admin do Feed do Discord, organizada em ABAS de configuração. Gated por
 * sessão + role ADMIN (o backend também exige admin — esta checagem é só de UI).
 */
export function FeedAdmin() {
  const { profile, isAuthenticated, isLoading } = useSession();
  const [tab, setTab] = useState<TabKey>("regras");

  if (isLoading) {
    return <div className="h-40 animate-pulse rounded-lg bg-gray-2" aria-hidden />;
  }
  if (!isAuthenticated) {
    return <p className="text-gray-11">Faça login para acessar.</p>;
  }
  if (profile?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-gray-6 bg-gray-2 p-6">
        <h1 className="text-lg font-semibold text-gray-12">Acesso restrito</h1>
        <p className="text-sm text-gray-11">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-gray-12">Feed do Discord</h1>
        <StatusBar />
      </header>

      {/* Abas */}
      <nav className="flex gap-1 border-b border-gray-6" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-principal-9 text-gray-12"
                : "border-transparent text-gray-11 hover:text-gray-12",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Conteúdo da aba */}
      {tab === "regras" && <MonitorsManager />}
      {tab === "blacklist" && <BlacklistManager />}
      {tab === "feed" && <FeedList />}
      {tab === "admins" && <PromoteAdmin />}
    </div>
  );
}
