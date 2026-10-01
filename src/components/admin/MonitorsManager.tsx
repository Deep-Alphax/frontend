"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createMonitor,
  deleteMonitor,
  getMonitors,
  getTelegramChats,
  updateMonitor,
  type CreateMonitorInput,
  type FeedMonitor,
  type MonitorPlatform,
} from "@/lib/api/feed";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { SkeletonGroup, TableSkeleton } from "@/components/ui/Skeleton";

interface FormState {
  id: string | null; // null = criando; setado = editando
  platform: MonitorPlatform;
  name: string;
  /** Discord: canal. Telegram: tópico do fórum (opcional). */
  channelId: string;
  /** Discord: servidor. Telegram: id do grupo (-100…). */
  guildId: string;
  pattern: string;
  telegramChatId: string;
  waitForBotReply: boolean;
  isActive: boolean;
  freeTier: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  platform: "DISCORD",
  name: "",
  channelId: "",
  guildId: "",
  pattern: "",
  telegramChatId: "",
  waitForBotReply: true,
  isActive: true,
  // Grupo novo nasce só-Pro: esquecer de marcar nunca vaza conteúdo pago.
  freeTier: false,
};

const PLATFORMS: Array<{ value: MonitorPlatform; label: string }> = [
  { value: "DISCORD", label: "Discord" },
  { value: "TELEGRAM", label: "Telegram" },
];

function PlatformBadge({ platform }: { platform: MonitorPlatform }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-medium",
        platform === "TELEGRAM" ? "bg-azul-9/15 text-azul-11" : "bg-violeta-9/15 text-violeta-11",
      )}
    >
      {platform === "TELEGRAM" ? "Telegram" : "Discord"}
    </span>
  );
}

/**
 * Gestão (CRUD) das regras de monitoramento — grupos do Discord E do
 * Telegram no mesmo lugar. As duas plataformas caem no mesmo feed (Radar),
 * no mesmo recorte FREE/PRO e alimentam o Tracker do mesmo jeito.
 */
export function MonitorsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const monitorsQuery = useQuery({
    queryKey: ["feed-monitors"],
    queryFn: getMonitors,
  });

  // Grupos em que a conta do leitor está — só busca com o form do Telegram aberto.
  const chatsQuery = useQuery({
    queryKey: ["telegram-chats"],
    queryFn: getTelegramChats,
    enabled: form?.platform === "TELEGRAM",
    staleTime: 60_000,
  });
  const chats = chatsQuery.data ?? [];
  const chatTitle = (id: string | null) =>
    id ? chats.find((c) => c.id === id)?.title : undefined;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["feed-monitors"] });
    queryClient.invalidateQueries({ queryKey: ["feed-status"] });
    queryClient.invalidateQueries({ queryKey: ["telegram-status"] });
    queryClient.invalidateQueries({ queryKey: ["telegram-chats"] });
  };

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const tg = f.platform === "TELEGRAM";
      const payload: CreateMonitorInput = {
        name: f.name.trim() || undefined,
        channelId: f.channelId.trim() || undefined,
        guildId: f.guildId.trim() || undefined,
        pattern: f.pattern.trim() || undefined, // vazio = espelha tudo
        // Telegram: "" limpa o repasse; Discord: obrigatório.
        telegramChatId: tg ? f.telegramChatId.trim() : f.telegramChatId.trim() || undefined,
        waitForBotReply: f.waitForBotReply,
        isActive: f.isActive,
        freeTier: f.freeTier,
      };
      // A plataforma só vai na criação (o backend não deixa trocar depois).
      return f.id ? updateMonitor(f.id, payload) : createMonitor({ ...payload, platform: f.platform });
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? "Rule updated" : "Rule created");
      setForm(null);
      invalidate();
    },
    onError: (err) =>
      toast.error(getApiErrorMessage(err, "Could not save the rule")),
  });

  const toggleMutation = useMutation({
    mutationFn: (m: FeedMonitor) =>
      updateMonitor(m.id, { isActive: !m.isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not toggle")),
  });

  const tierMutation = useMutation({
    mutationFn: (m: FeedMonitor) =>
      updateMonitor(m.id, { freeTier: !m.freeTier }),
    onSuccess: (_, m) => {
      toast.success(
        m.freeTier ? "Group is now Pro only" : "Group released to Free",
      );
      invalidate();
    },
    onError: (err) =>
      toast.error(getApiErrorMessage(err, "Could not change the plan")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMonitor(id),
    onSuccess: () => {
      toast.success("Rule removed");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not remove")),
  });

  const monitors = monitorsQuery.data ?? [];
  const isTg = form?.platform === "TELEGRAM";
  const canSave =
    !!form &&
    (isTg
      ? /^-?\d{5,20}$/.test(form.guildId.trim()) &&
        (!form.channelId.trim() || /^\d{1,12}$/.test(form.channelId.trim()))
      : (form.channelId.trim() || form.guildId.trim()) && form.telegramChatId.trim());
  const selectedChat = isTg ? chats.find((c) => c.id === form?.guildId.trim()) : undefined;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-12">
            Monitoring rules
          </h2>
          <p className="text-sm text-gray-11">
            Discord or Telegram group → feed (Radar + Tracker). No pattern ={" "}
            <b>mirrors everything</b>; with a pattern (regex <code>/body/flags</code> or plain
            text) = filters.
          </p>
        </div>
        {!form && (
          <Button className="w-auto shrink-0" onClick={() => setForm({ ...EMPTY_FORM })}>
            New rule
          </Button>
        )}
      </div>

      {/* Formulário (criar/editar) */}
      {form && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-1 p-4">
          {/* Plataforma: escolhida na criação, fixa na edição. */}
          <div role="radiogroup" aria-label="Platform" className="flex w-fit rounded-lg border border-gray-6 bg-gray-2 p-1">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={form.platform === p.value}
                disabled={!!form.id && form.platform !== p.value}
                onClick={() => {
                  if (form.platform === p.value) return;
                  setForm({ ...EMPTY_FORM, id: form.id, name: form.name, platform: p.value });
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40",
                  form.platform === p.value ? "bg-gray-4 text-gray-12" : "text-gray-11 hover:text-gray-12",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isTg ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Name (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Alpha Calls BR"
              />
              <label className="flex flex-col gap-1.5 text-sm text-gray-12">
                <span>Telegram group</span>
                {chats.length > 0 ? (
                  <select
                    value={chats.some((c) => c.id === form.guildId) ? form.guildId : ""}
                    onChange={(e) => {
                      const chat = chats.find((c) => c.id === e.target.value);
                      setForm({
                        ...form,
                        guildId: e.target.value,
                        name: form.name || chat?.title || "",
                        channelId: chat?.forum ? form.channelId : "",
                      });
                    }}
                    className="h-10 rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none focus-visible:border-secundaria-11/60"
                  >
                    <option value="">Choose a group the account is in…</option>
                    {chats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                        {c.username ? ` (@${c.username})` : ""}
                        {c.kind === "channel" ? " · channel" : ""}
                        {c.watched ? " · already monitored" : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-11">
                    {chatsQuery.isLoading
                      ? "Loading the account's groups…"
                      : "Reader offline or in no group — type the group id below."}
                  </span>
                )}
              </label>
              <TextField
                label="Group id"
                value={form.guildId}
                onChange={(e) => setForm({ ...form, guildId: e.target.value })}
                placeholder="-1001234567890"
              />
              <TextField
                label={selectedChat?.forum ? "Topic id (optional — empty = whole group)" : "Topic id (forums only, optional)"}
                value={form.channelId}
                onChange={(e) => setForm({ ...form, channelId: e.target.value })}
                placeholder="e.g. 7"
              />
              <TextField
                label="Pattern — empty = captures EVERYTHING"
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder="leave empty to capture everything (or /0x…/i)"
              />
              <TextField
                label="Forward to Telegram chat (optional)"
                value={form.telegramChatId}
                onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                placeholder="-1004299449661 (empty = no forward)"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextField
                label="Name (optional)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Alpha calls #1"
              />
              <TextField
                label="Channel ID (or use the server →)"
                value={form.channelId}
                onChange={(e) => setForm({ ...form, channelId: e.target.value })}
                placeholder="1013855610871226480"
              />
              <TextField
                label="Server ID (empty channel = whole server)"
                value={form.guildId}
                onChange={(e) => setForm({ ...form, guildId: e.target.value })}
                placeholder="guild id (optional)"
              />
              <TextField
                label="Pattern — empty = mirrors EVERYTHING"
                value={form.pattern}
                onChange={(e) => setForm({ ...form, pattern: e.target.value })}
                placeholder="leave empty to mirror everything (or /0x…/i)"
              />
              <TextField
                label="Telegram chat/channel ID"
                value={form.telegramChatId}
                onChange={(e) =>
                  setForm({ ...form, telegramChatId: e.target.value })
                }
                placeholder="-1004299449661"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-6">
            {!isTg && (
              <label className="flex items-center gap-2 text-sm text-gray-12">
                <input
                  type="checkbox"
                  checked={form.waitForBotReply}
                  onChange={(e) =>
                    setForm({ ...form, waitForBotReply: e.target.checked })
                  }
                  className="size-4 accent-principal-9"
                />
                Wait for the bot reply (rich data)
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-12">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
                className="size-4 accent-principal-9"
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-12">
              <input
                type="checkbox"
                checked={form.freeTier}
                onChange={(e) =>
                  setForm({ ...form, freeTier: e.target.checked })
                }
                className="size-4 accent-principal-9"
              />
              Available on the Free plan
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              className="w-auto"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => form && saveMutation.mutate(form)}
            >
              {saveMutation.isPending
                ? "Saving…"
                : form.id
                  ? "Save"
                  : "Create rule"}
            </Button>
            <Button
              variant="secondary"
              className="w-auto"
              onClick={() => setForm(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Tabela de regras */}
      {monitorsQuery.isLoading ? (
        <SkeletonGroup className="py-2">
          <TableSkeleton rows={5} cols={7} />
        </SkeletonGroup>
      ) : monitors.length === 0 ? (
        <p className="text-sm text-gray-11">
          No rules yet. Create the first one.
        </p>
      ) : (
        <ScrollArea orientation="horizontal">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-gray-11">
                <tr className="border-b border-gray-6">
                  <th className="py-2 pr-4 font-medium">Rule</th>
                  <th className="py-2 pr-4 font-medium">Platform</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Forward</th>
                  <th className="py-2 pr-4 font-medium">Active</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-gray-6/50 text-gray-12"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium">{m.name || "—"}</div>
                      {m.pattern ? (
                        <code className="text-xs text-gray-11">{m.pattern}</code>
                      ) : (
                        <span className="text-xs text-green-11">
                          {m.platform === "TELEGRAM" ? "captures everything" : "mirrors everything"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <PlatformBadge platform={m.platform ?? "DISCORD"} />
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-11">
                      {m.platform === "TELEGRAM" ? (
                        <>
                          {chatTitle(m.guildId) ? (
                            <span className="font-sans text-gray-12">{chatTitle(m.guildId)} </span>
                          ) : null}
                          {m.guildId}
                          {m.channelId && <span className="text-secundaria-11"> · topic {m.channelId}</span>}
                        </>
                      ) : m.channelId ? (
                        m.channelId
                      ) : (
                        <span className="text-secundaria-11">
                          server {m.guildId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-gray-11">
                      {m.telegramChatId || "—"}
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => toggleMutation.mutate(m)}
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (m.isActive
                            ? "bg-green-10/20 text-green-11"
                            : "bg-gray-6/40 text-gray-11")
                        }
                      >
                        {m.isActive ? "active" : "inactive"}
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      {/* Um clique libera/tira do FREE. O feed do FREE (REST e
                          socket) passa a refletir na requisição seguinte. */}
                      <button
                        onClick={() => tierMutation.mutate(m)}
                        disabled={tierMutation.isPending}
                        title={
                          m.freeTier
                            ? "Visible to Free and Pro"
                            : "Visible to Pro only"
                        }
                        className={
                          "rounded-full px-2 py-0.5 text-xs font-medium " +
                          (m.freeTier
                            ? "bg-secundaria-11/15 text-secundaria-11"
                            : "bg-principal-9/15 text-principal-9")
                        }
                      >
                        {m.freeTier ? "Free + Pro" : "Pro only"}
                      </button>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setForm({
                              id: m.id,
                              platform: m.platform ?? "DISCORD",
                              name: m.name ?? "",
                              channelId: m.channelId ?? "",
                              guildId: m.guildId ?? "",
                              pattern: m.pattern ?? "",
                              telegramChatId: m.telegramChatId ?? "",
                              waitForBotReply: m.waitForBotReply,
                              isActive: m.isActive,
                              freeTier: m.freeTier,
                            })
                          }
                          className="text-secundaria-11 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(`Remove the rule "${m.name || m.pattern || m.guildId}"?`)
                            ) {
                              deleteMutation.mutate(m.id);
                            }
                          }}
                          className="text-danger-11 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </ScrollArea>
      )}
    </section>
  );
}
