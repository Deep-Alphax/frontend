"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createMonitor,
  deleteMonitor,
  getMonitors,
  updateMonitor,
  type CreateMonitorInput,
  type FeedMonitor,
} from "@/lib/api/feed";
import { getApiErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

interface FormState {
  id: string | null; // null = criando; setado = editando
  name: string;
  channelId: string;
  guildId: string;
  pattern: string;
  telegramChatId: string;
  waitForBotReply: boolean;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  id: null,
  name: "",
  channelId: "",
  guildId: "",
  pattern: "",
  telegramChatId: "",
  waitForBotReply: true,
  isActive: true,
};

/** Gestão (CRUD) das regras de monitoramento do Discord. */
export function MonitorsManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const monitorsQuery = useQuery({ queryKey: ["feed-monitors"], queryFn: getMonitors });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["feed-monitors"] });
    queryClient.invalidateQueries({ queryKey: ["feed-status"] });
  };

  const saveMutation = useMutation({
    mutationFn: (f: FormState) => {
      const payload: CreateMonitorInput = {
        name: f.name.trim() || undefined,
        channelId: f.channelId.trim() || undefined,
        guildId: f.guildId.trim() || undefined,
        pattern: f.pattern.trim() || undefined, // vazio = espelha tudo
        telegramChatId: f.telegramChatId.trim(),
        waitForBotReply: f.waitForBotReply,
        isActive: f.isActive,
      };
      return f.id ? updateMonitor(f.id, payload) : createMonitor(payload);
    },
    onSuccess: (_, f) => {
      toast.success(f.id ? "Rule updated" : "Rule created");
      setForm(null);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not save the rule")),
  });

  const toggleMutation = useMutation({
    mutationFn: (m: FeedMonitor) => updateMonitor(m.id, { isActive: !m.isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getApiErrorMessage(err, "Could not toggle")),
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
  const canSave =
    !!form && (form.channelId.trim() || form.guildId.trim()) && form.telegramChatId.trim();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-12">Monitoring rules</h2>
          <p className="text-sm text-gray-11">
            Discord channel → Telegram. No pattern = <b>mirrors everything</b>; with a pattern
            (regex <code>/body/flags</code> or plain text) = filters.
          </p>
        </div>
        {!form && (
          <Button className="w-auto" onClick={() => setForm({ ...EMPTY_FORM })}>
            Nova regra
          </Button>
        )}
      </div>

      {/* Formulário (criar/editar) */}
      {form && (
        <div className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-1 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextField
              label="Name (optional)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ex.: Alpha calls #1"
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
              placeholder="guild id (opcional)"
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
              onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
              placeholder="-1004299449661"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-12">
              <input
                type="checkbox"
                checked={form.waitForBotReply}
                onChange={(e) => setForm({ ...form, waitForBotReply: e.target.checked })}
                className="size-4 accent-principal-9"
              />
              Wait for the bot reply (rich data)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-12">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="size-4 accent-principal-9"
              />
              Ativa
            </label>
          </div>

          <div className="flex gap-3">
            <Button
              className="w-auto"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => form && saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? "Saving…" : form.id ? "Save" : "Create rule"}
            </Button>
            <Button variant="secondary" className="w-auto" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Tabela de regras */}
      {monitorsQuery.isLoading ? (
        <p className="text-sm text-gray-11">Loading…</p>
      ) : monitors.length === 0 ? (
        <p className="text-sm text-gray-11">No rules yet. Create the first one.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-gray-11">
              <tr className="border-b border-gray-6">
                <th className="py-2 pr-4 font-medium">Rule</th>
                <th className="py-2 pr-4 font-medium">Channel</th>
                <th className="py-2 pr-4 font-medium">Telegram</th>
                <th className="py-2 pr-4 font-medium">Active</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={m.id} className="border-b border-gray-6/50 text-gray-12">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{m.name || "—"}</div>
                    {m.pattern ? (
                      <code className="text-xs text-gray-11">{m.pattern}</code>
                    ) : (
                      <span className="text-xs text-green-11">espelha tudo</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-11">
                    {m.channelId ? (
                      m.channelId
                    ) : (
                      <span className="text-secundaria-11">servidor {m.guildId}</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-gray-11">{m.telegramChatId}</td>
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
                      {m.isActive ? "ativa" : "inativa"}
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setForm({
                            id: m.id,
                            name: m.name ?? "",
                            channelId: m.channelId ?? "",
                            guildId: m.guildId ?? "",
                            pattern: m.pattern ?? "",
                            telegramChatId: m.telegramChatId,
                            waitForBotReply: m.waitForBotReply,
                            isActive: m.isActive,
                          })
                        }
                        className="text-secundaria-11 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Remove the rule "${m.name || m.pattern}"?`)) {
                            deleteMutation.mutate(m.id);
                          }
                        }}
                        className="text-danger-11 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
