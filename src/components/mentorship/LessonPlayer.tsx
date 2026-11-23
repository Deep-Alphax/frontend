"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  MENTORSHIP_OVERVIEW_KEY,
  saveLessonProgress,
  type MentorshipLesson,
} from "@/lib/api/mentorship";
import { API_URL } from "@/lib/env";
import { attachPlayer } from "@/lib/mentorship/player";
import { toVideoEmbed } from "@/lib/mentorship/video";

/*
 * Player da aula com PROGRESSO REAL (antes: só o botão "Mark as completed"
 * mexia no progresso, e a % e o "min left" eram de mentira).
 *
 * - Retoma onde o aluno parou (embed com `start`), a não ser que a aula já
 *   esteja concluída ou que falte pouco para o fim.
 * - Salva a posição a cada 30 s tocando, ao pausar, ao trocar de aba / fechar
 *   (fetch `keepalive`, que sobrevive ao fechamento) e ao sair da tela.
 * - Passou de 90% → conclui sozinha (`onAutoComplete`), sem esperar o fim.
 *
 * Carga no backend: ~1 PATCH a cada 30 s por aluno ASSISTINDO (parado não
 * salva nada). O servidor prende a posição à duração real da aula, então o
 * cliente não "conclui" nada que não foi assistido.
 */

/** Intervalo entre salvamentos enquanto o vídeo toca. */
export const SAVE_EVERY_SEC = 30;
/** Fração assistida que conta como concluída. */
export const COMPLETE_AT = 0.9;
/** Não retoma nos primeiros segundos nem quando falta pouco para acabar. */
const MIN_RESUME_SEC = 5;
const RESUME_TAIL_SEC = 15;

/** Segundo de onde o embed deve começar. 0 = do início. */
export function resumeAt(lesson: MentorshipLesson): number {
  if (lesson.completed) return 0;
  const pos = lesson.positionSec;
  if (pos < MIN_RESUME_SEC) return 0;
  if (lesson.durationSec > 0 && pos > lesson.durationSec - RESUME_TAIL_SEC) {
    return 0;
  }
  return Math.floor(pos);
}

export function LessonPlayer({
  lesson,
  title,
  onAutoComplete,
}: {
  lesson: MentorshipLesson;
  title: string;
  /** Chamado UMA vez quando passa de 90% (ou o vídeo termina). */
  onAutoComplete: (positionSec: number) => void;
}) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // O `src` é calculado UMA vez: recalcular a cada render (o overview é
  // revalidado depois de concluir) recarregaria o vídeo no meio.
  const [embed] = useState(() =>
    toVideoEmbed(lesson.videoUrl, {
      startSec: resumeAt(lesson),
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
    }),
  );

  // Último callback sem reanexar o player quando ele muda de identidade.
  const onAutoCompleteRef = useRef(onAutoComplete);
  useEffect(() => {
    onAutoCompleteRef.current = onAutoComplete;
  }, [onAutoComplete]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!embed || !iframe) return;

    const lessonId = lesson.id;
    let latest = lesson.positionSec;
    let lastSaved = lesson.positionSec;
    let completedSent = lesson.completed;
    let disposed = false;

    const save = (sec: number) => {
      const positionSec = Math.floor(sec);
      if (Math.abs(positionSec - lastSaved) < 2) return;
      lastSaved = positionSec;
      void saveLessonProgress(lessonId, { positionSec }).catch(() => {
        // Falha de rede: o próximo salvamento leva a posição mais nova.
      });
    };

    /** Envio que sobrevive ao fechar a aba (o axios seria cancelado). */
    const beacon = () => {
      const positionSec = Math.floor(latest);
      if (Math.abs(positionSec - lastSaved) < 2) return;
      lastSaved = positionSec;
      void fetch(`${API_URL}/api/v1/mentorship/lessons/${lessonId}/progress`, {
        method: "PATCH",
        keepalive: true,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-pt-surface": "client",
        },
        body: JSON.stringify({ positionSec }),
      }).catch(() => {});
    };

    const complete = (sec: number) => {
      if (completedSent) return;
      completedSent = true;
      lastSaved = Math.floor(sec);
      onAutoCompleteRef.current(Math.floor(sec));
    };

    let handle: { destroy: () => void } | null = null;
    attachPlayer(iframe, embed.provider, {
      onTime: (sec, duration) => {
        latest = sec;
        if (duration > 0 && sec / duration >= COMPLETE_AT) {
          complete(sec);
          return;
        }
        // Voltar no vídeo também salva (senão o "continue" apontaria à frente).
        if (sec - lastSaved >= SAVE_EVERY_SEC || sec < lastSaved - SAVE_EVERY_SEC) {
          save(sec);
        }
      },
      onPause: (sec) => {
        latest = sec;
        save(sec);
      },
      onEnded: (duration) => {
        latest = duration;
        complete(duration);
      },
    })
      .then((h) => {
        if (disposed) h.destroy();
        else handle = h;
      })
      .catch(() => {
        // API do player bloqueada (adblock/offline): vídeo segue tocando, só
        // sem rastreio. O botão "Mark as completed" continua funcionando.
      });

    const onHide = () => {
      if (document.visibilityState === "hidden") beacon();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", beacon);

    return () => {
      disposed = true;
      handle?.destroy();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", beacon);
      // Saindo da aula pela navegação do app: salva e atualiza a lista, para o
      // "Continue where you left off" já mostrar a posição nova.
      save(latest);
      void queryClient.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
    };
    // Reanexa só se trocar de aula (o iframe é o mesmo durante a aula).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embed, lesson.id]);

  if (!embed) return null;

  return (
    <iframe
      ref={iframeRef}
      src={embed.src}
      title={title}
      // `allow` mínimo: sem `autoplay` (o usuário decide) e sem
      // `camera`/`microphone`, que um player de vídeo não usa.
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="size-full"
    />
  );
}
