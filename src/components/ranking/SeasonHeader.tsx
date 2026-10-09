"use client";

import { useState, useSyncExternalStore } from "react";

import type { RankingSeason } from "@/lib/api/ranking";
import { MISS_POINTS, POINTS_TABLE, countdown, seasonClock } from "@/lib/ranking/rules";
import { Modal } from "@/components/walletReader/Modal";

/** Caixa de uma unidade do contador (Figma "Unidade · dias", 1463:13491). */
function Unit({ value, unit }: { value: string; unit: string }) {
  return (
    <span className="flex flex-col items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 p-3 whitespace-nowrap">
      <span className="font-display text-xl font-semibold leading-[1.1] tracking-[1px] text-gray-12 tabular-nums">
        {value}
      </span>
      <span className="text-xs leading-[1.3] text-gray-11">{unit}</span>
    </span>
  );
}

/** Relógio de 1s como store externo: no servidor (e na hidratação) é `null`. */
const subscribeSecond = (onTick: () => void) => {
  const t = window.setInterval(onTick, 1000);
  return () => window.clearInterval(t);
};
const currentSecond = () => Math.floor(Date.now() / 1000);
const noClock = () => null;

/**
 * Contador da temporada (Figma 1463:13489). O relógio só existe no cliente:
 * renderizar o horário no servidor daria hidratação divergente. O tique de 1s
 * fica AQUI — o resto da tela não re-renderiza.
 */
export function SeasonCountdown({ season }: { season: RankingSeason }) {
  const clock = seasonClock(season);
  const sec = useSyncExternalStore(subscribeSecond, currentSecond, noClock);
  const now = sec == null ? null : new Date(sec * 1000);

  if (!clock) {
    return <p className="text-sm leading-[1.3] text-gray-11">{season.name} has ended</p>;
  }
  const c = now ? countdown(clock.target, now) : { days: "--", hours: "--", min: "--", sec: "--" };
  return (
    <div
      role="timer"
      aria-label={`${clock.label} ${c.days} days ${c.hours} hours ${c.min} minutes`}
      className="flex items-center gap-2"
    >
      <p className="w-24 text-sm leading-[1.3] text-gray-11">{clock.label}</p>
      <Unit value={c.days} unit="days" />
      <Unit value={c.hours} unit="hours" />
      <Unit value={c.min} unit="min" />
      <Unit value={c.sec} unit="sec" />
    </div>
  );
}

/** "How it works" — regras de pontuação (espelho de `ranking.rules.ts` no backend). */
export function HowItWorksButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded border border-gray-6 bg-gray-3 px-3 py-2 text-sm leading-[1.3] text-gray-11 transition-colors hover:text-gray-12"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone do Figma */}
        <img src="/ranking/info-16.svg" alt="" width={16} height={16} />
        How it works
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="How the Deep Ranking works">
        <div className="flex flex-col gap-5 p-5 text-sm leading-relaxed text-gray-11">
          <p>
            Every KOL in the Deep Alpha index is ranked by the calls they post in the groups and
            sources we track. A call is a token contract shared by the KOL.
          </p>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold text-gray-12">Points per call</h3>
            <p>
              Each call is scored by the token&apos;s peak market cap in the 24 hours after the
              call, compared with the market cap at the moment of the call.
            </p>
            <ul className="overflow-clip rounded-lg border border-gray-6">
              {POINTS_TABLE.map((t) => (
                <li
                  key={t.min}
                  className="flex justify-between border-b border-gray-6 px-3 py-2 last:border-b-0"
                >
                  <span>{t.min}x or more</span>
                  <span className="font-semibold text-green-11">+{t.points}</span>
                </li>
              ))}
              <li className="flex justify-between px-3 py-2">
                <span>Below {POINTS_TABLE[POINTS_TABLE.length - 1].min}x</span>
                <span className="font-semibold text-vermelho-11">{MISS_POINTS}</span>
              </li>
            </ul>
          </div>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>Only the first call of each token counts. Posting it again in other groups adds nothing.</li>
            <li>
              <span className="text-gray-12">Hit rate</span> is the share of calls that reached 2x
              within 24 hours.
            </li>
            <li>
              A call is scored once its 24-hour window closes. The standings refresh every 5
              minutes; the arrows compare with the standings at 00:00 UTC.
            </li>
            <li>Prizes are set for each season and go to the top positions when it ends.</li>
          </ul>
        </div>
      </Modal>
    </>
  );
}
