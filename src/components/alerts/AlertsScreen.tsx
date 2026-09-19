"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { AtSign, Bell, BellOff, Hash, Loader2, Search, Trash2 } from "lucide-react";

import { Topbar } from "@/components/home/Topbar";
import { ProLock } from "@/components/plans/ProLock";
import {
  ALERT_RULES_KEY,
  createAlertRule,
  deleteAlertRule,
  getAlertRules,
  updateAlertRule,
  type AlertKind,
  type AlertRule,
} from "@/lib/api/alerts";
import { getFavorites, getFeedGroups } from "@/lib/api/feed";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/alerts/push";
import { toastApiError } from "@/lib/billing/planErrors";
import { cn } from "@/lib/cn";

const KINDS: { id: AlertKind; label: string; hint: string; Icon: typeof AtSign }[] = [
  { id: "AUTHOR", label: "Caller", hint: "Someone posts", Icon: AtSign },
  { id: "CHANNEL", label: "Channel", hint: "Anything lands in a channel", Icon: Hash },
  { id: "KEYWORD", label: "Keyword", hint: "A ticker, CA or word is mentioned", Icon: Search },
];

const KIND_LABEL: Record<AlertKind, string> = {
  AUTHOR: "Caller",
  CHANNEL: "Channel",
  KEYWORD: "Keyword",
};

const INPUT =
  "h-10 w-full rounded-lg border border-gray-6 bg-gray-2 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus:border-secundaria-11/60";

/**
 * Alertas (FREE 1, Pro ilimitado): criar/gerenciar regras e ligar o push
 * neste navegador. O limite é do backend (403 `PLAN_LIMIT`); a tela só evita
 * oferecer o que ele vai recusar.
 */
export function AlertsScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ALERT_RULES_KEY,
    queryFn: getAlertRules,
  });

  const atLimit = data ? data.limit !== null && data.items.length >= data.limit : false;

  return (
    <div className="flex min-h-dvh flex-col bg-gray-1">
      <Topbar />
      <main className="flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pb-20 pt-8 md:px-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold leading-[1.1] text-gray-12">Alerts</h1>
              {data && (
                <span className="rounded-full border border-gray-6 bg-gray-2 px-2.5 py-1 text-xs font-medium text-gray-11">
                  {data.limit === null
                    ? `${data.items.length} active · Pro`
                    : `${data.items.length} of ${data.limit} · Free`}
                </span>
              )}
            </div>
            <p className="text-sm leading-[1.4] text-gray-11">
              Get notified the moment a caller posts, a channel moves or a ticker is
              mentioned — here in the bell and, if you want, on this device.
            </p>
          </header>

          <PushCard />

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-gray-11" />
            </div>
          ) : atLimit ? (
            <ProLock
              title="Unlimited alerts with Pro"
              detail={`The Free plan includes ${data?.limit ?? 1} alert. Delete it to create another, or upgrade.`}
            />
          ) : (
            <NewAlertForm />
          )}

          {data && data.items.length > 0 && <RulesList rules={data.items} />}
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────── Push ───────────────────────────────

function PushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushState().then(setState, () => setState("unsupported"));
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") toast.success("Notifications enabled on this device.");
      if (next === "denied") toast.error("Notifications are blocked in your browser settings.");
      if (next === "disabled") toast.error("Push notifications are not available right now.");
    } catch {
      toast.error("Could not change notifications on this device.");
    } finally {
      setBusy(false);
    }
  };

  const copy: Record<PushState, string> = {
    on: "You'll get a notification on this device even with the site closed.",
    off: "Turn on to get alerts on this device even with the site closed.",
    denied:
      "Notifications are blocked for this site. Allow them in your browser settings to turn this on.",
    unsupported:
      "This browser doesn't support push notifications. On iPhone, add the site to your Home Screen first.",
    disabled: "Push notifications are not available right now. Alerts still show in the bell.",
  };

  const canToggle = state === "on" || state === "off";

  return (
    <section className="flex items-center justify-between gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4">
      <div className="flex min-w-0 items-start gap-3">
        {state === "on" ? (
          <Bell className="mt-0.5 size-5 shrink-0 text-green-11" />
        ) : (
          <BellOff className="mt-0.5 size-5 shrink-0 text-gray-11" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-semibold text-gray-12">Notifications on this device</p>
          <p className="text-[13px] leading-[1.4] text-gray-11">
            {state ? copy[state] : "Checking…"}
          </p>
        </div>
      </div>
      {canToggle && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={cn(
            "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-60",
            state === "on"
              ? "border border-gray-6 bg-gray-3 text-gray-12 hover:bg-gray-4"
              : "bg-principal-9 text-gray-1 hover:bg-principal-10",
          )}
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {state === "on" ? "Turn off" : "Turn on"}
        </button>
      )}
    </section>
  );
}

// ─────────────────────────────── Nova regra ───────────────────────────────

function NewAlertForm() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<AlertKind>("AUTHOR");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState<string | undefined>();

  // Sugestões: quem o usuário já segue (caller) e os canais que ELE vê no feed
  // (o backend já recorta pelo plano — o FREE só recebe os grupos liberados).
  const favorites = useQuery({
    queryKey: ["alerts-favorites"],
    queryFn: getFavorites,
    enabled: kind === "AUTHOR",
    staleTime: 5 * 60_000,
  });
  const groups = useQuery({
    queryKey: ["alerts-groups"],
    queryFn: getFeedGroups,
    enabled: kind === "CHANNEL",
    staleTime: 5 * 60_000,
  });

  const followed = useMemo(
    () => (favorites.data ?? []).filter((f) => f.followed && f.authorTag).slice(0, 12),
    [favorites.data],
  );
  const channels = useMemo(
    () =>
      (groups.data ?? []).flatMap((g) =>
        g.channels.map((c) => ({
          id: c.channelId,
          label: `${g.guildName ?? "Server"} · #${c.channelName ?? c.channelId}`,
        })),
      ),
    [groups.data],
  );

  const reset = () => {
    setValue("");
    setLabel(undefined);
  };

  const create = useMutation({
    mutationFn: () => createAlertRule({ kind, value: value.trim(), label }),
    onSuccess: () => {
      toast.success("Alert created.");
      reset();
      qc.invalidateQueries({ queryKey: ALERT_RULES_KEY });
    },
    onError: (e) => {
      if (e instanceof AxiosError && e.response?.status === 409) {
        toast.error("You already have this alert.");
        return;
      }
      toastApiError(e, "Could not create the alert.");
    },
  });

  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 2 && !create.isPending;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4">
      <p className="text-sm font-semibold text-gray-12">New alert</p>

      <div role="radiogroup" aria-label="Alert type" className="grid grid-cols-3 gap-2">
        {KINDS.map(({ id, label: l, hint, Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            onClick={() => {
              setKind(id);
              reset();
            }}
            className={cn(
              "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
              kind === id
                ? "border-principal-9/60 bg-principal-9/10"
                : "border-gray-6 bg-gray-1 hover:bg-gray-3",
            )}
          >
            <Icon className={cn("size-4", kind === id ? "text-principal-9" : "text-gray-11")} />
            <span className="text-sm font-semibold text-gray-12">{l}</span>
            <span className="hidden text-xs leading-[1.3] text-gray-11 sm:block">{hint}</span>
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) create.mutate();
        }}
      >
        {kind === "CHANNEL" ? (
          <select
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLabel(channels.find((c) => c.id === e.target.value)?.label);
            }}
            aria-label="Channel"
            className={INPUT}
          >
            <option value="">
              {groups.isLoading ? "Loading channels…" : "Pick a channel"}
            </option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setLabel(undefined);
            }}
            maxLength={100}
            aria-label={kind === "AUTHOR" ? "Caller username" : "Keyword"}
            placeholder={
              kind === "AUTHOR"
                ? "Username as it shows in the feed"
                : "e.g. $WIF, a contract address or a word"
            }
            className={INPUT}
          />
        )}

        {kind === "AUTHOR" && followed.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-11">From your favorites:</span>
            {followed.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setValue(f.authorTag!);
                  setLabel(f.nickname ?? undefined);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  value === f.authorTag
                    ? "border-principal-9/60 bg-principal-9/10 text-gray-12"
                    : "border-gray-6 bg-gray-1 text-gray-11 hover:text-gray-12",
                )}
              >
                {f.nickname || f.authorTag}
              </button>
            ))}
          </div>
        )}

        {kind === "KEYWORD" && (
          <p className="text-xs leading-[1.4] text-gray-11">
            Matches anywhere in the message, ignoring case. Use at least 2 characters.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-principal-9 px-5 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {create.isPending && <Loader2 className="size-4 animate-spin" />}
          Create alert
        </button>
      </form>
    </section>
  );
}

// ─────────────────────────────── Lista ───────────────────────────────

function RulesList({ rules }: { rules: AlertRule[] }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ALERT_RULES_KEY });

  const toggle = useMutation({
    mutationFn: (r: AlertRule) => updateAlertRule(r.id, { isActive: !r.isActive }),
    onSuccess: refresh,
    onError: (e) => toastApiError(e, "Could not update the alert."),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteAlertRule(id),
    onSuccess: () => {
      toast.success("Alert deleted.");
      refresh();
    },
    onError: (e) => toastApiError(e, "Could not delete the alert."),
  });

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-gray-12">Your alerts</p>
      <ul className="flex flex-col overflow-hidden rounded-xl border border-gray-6 bg-gray-2">
        {rules.map((r) => {
          // Ativa mas sem disparar = sobrou de quando era Pro (o FREE só roda 1).
          const pausedByPlan = r.isActive && !r.effective;
          return (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-gray-6/60 px-4 py-3 last:border-b-0"
            >
              <span className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-gray-11">
                {KIND_LABEL[r.kind]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-gray-12">
                  {r.label || r.value}
                </span>
                {pausedByPlan && (
                  <span className="text-xs text-principal-9">
                    Paused — the Free plan runs 1 alert. Upgrade to resume.
                  </span>
                )}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={r.isActive}
                aria-label={r.isActive ? "Pause alert" : "Resume alert"}
                onClick={() => toggle.mutate(r)}
                disabled={toggle.isPending}
                className={cn(
                  "relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60",
                  r.isActive ? "bg-green-10" : "bg-gray-6",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-4 rounded-full bg-gray-12 transition-transform",
                    r.isActive ? "translate-x-[18px]" : "translate-x-0.5",
                  )}
                />
              </button>
              <button
                type="button"
                aria-label="Delete alert"
                onClick={() => remove.mutate(r.id)}
                disabled={remove.isPending}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-vermelho-11 disabled:opacity-60"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
