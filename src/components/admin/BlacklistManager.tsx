"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  createBlacklist,
  deleteBlacklist,
  getBlacklist,
  updateBlacklist,
  type BlacklistedUser,
} from "@/lib/api/feed";
import { getApiErrorMessage } from "@/lib/api/client";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

const EMPTY = { discordUserId: "", username: "", reason: "" };

/** Gestão da blacklist de usuários do Discord (mensagens deles não vão ao Telegram). */
export function BlacklistManager() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);

  const listQuery = useQuery({ queryKey: ["feed-blacklist"], queryFn: getBlacklist });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["feed-blacklist"] });
    queryClient.invalidateQueries({ queryKey: ["feed-status"] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      createBlacklist({
        discordUserId: form.discordUserId.trim() || undefined,
        username: form.username.trim() || undefined,
        reason: form.reason.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Usuário bloqueado");
      setForm(EMPTY);
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Falha ao bloquear")),
  });

  const toggleMutation = useMutation({
    mutationFn: (b: BlacklistedUser) => updateBlacklist(b.id, { isActive: !b.isActive }),
    onSuccess: invalidate,
    onError: (err) => toast.error(getApiErrorMessage(err, "Falha ao alternar")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBlacklist(id),
    onSuccess: () => {
      toast.success("Removido da blacklist");
      invalidate();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Falha ao remover")),
  });

  const items = listQuery.data ?? [];
  const canAdd = form.discordUserId.trim() || form.username.trim();

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-gray-6 bg-gray-2 p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-12">Blacklist de usuários</h2>
        <p className="text-sm text-gray-11">
          Mensagens desses usuários <b>não</b> vão pro Telegram. Bloqueie por ID do Discord
          (exato) e/ou username/tag (parte). Vale para todos os canais.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <TextField
          label="ID do Discord (opcional)"
          value={form.discordUserId}
          onChange={(e) => setForm({ ...form, discordUserId: e.target.value })}
          placeholder="1537270515381698630"
        />
        <TextField
          label="Username/tag (opcional)"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          placeholder="spammer  (ou parte do nome)"
        />
        <TextField
          label="Motivo (opcional)"
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
          placeholder="spam, ruído…"
        />
      </div>
      <div>
        <Button
          className="w-auto"
          disabled={!canAdd || addMutation.isPending}
          onClick={() => addMutation.mutate()}
        >
          {addMutation.isPending ? "Bloqueando…" : "Bloquear usuário"}
        </Button>
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-gray-11">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-11">Ninguém na blacklist.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="text-gray-11">
              <tr className="border-b border-gray-6">
                <th className="py-2 pr-4 font-medium">ID / Username</th>
                <th className="py-2 pr-4 font-medium">Motivo</th>
                <th className="py-2 pr-4 font-medium">Ativo</th>
                <th className="py-2 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-gray-6/50 text-gray-12">
                  <td className="py-3 pr-4">
                    {b.discordUserId && (
                      <div className="font-mono text-xs text-gray-11">{b.discordUserId}</div>
                    )}
                    {b.username && <div className="font-medium">{b.username}</div>}
                  </td>
                  <td className="py-3 pr-4 text-gray-11">{b.reason || "—"}</td>
                  <td className="py-3 pr-4">
                    <button
                      onClick={() => toggleMutation.mutate(b)}
                      className={
                        "rounded-full px-2 py-0.5 text-xs font-medium " +
                        (b.isActive
                          ? "bg-danger-10/20 text-danger-11"
                          : "bg-gray-6/40 text-gray-11")
                      }
                    >
                      {b.isActive ? "bloqueado" : "inativo"}
                    </button>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => {
                        if (confirm("Remover da blacklist?")) deleteMutation.mutate(b.id);
                      }}
                      className="text-danger-11 hover:underline"
                    >
                      Remover
                    </button>
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
