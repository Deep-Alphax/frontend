"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CircleAlert, CircleCheck, Trash2, X } from "lucide-react";

import { FileDropField } from "@/components/admin/FileDropField";
import { MaterialsEditor } from "@/components/admin/MaterialsEditor";
import {
  Field,
  inputCls,
  primaryBtnCls,
  secondaryBtnCls,
  textareaCls,
} from "@/components/admin/MentorshipAdminUi";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  createLesson,
  createMaterial,
  deleteLesson,
  updateLesson,
  type AdminLesson,
  type MaterialPayload,
} from "@/lib/api/mentorship";
import { formatClock, parseClock } from "@/lib/mentorship/format";
import { attachPlayer } from "@/lib/mentorship/player";
import { toVideoEmbed, type VideoProvider } from "@/lib/mentorship/video";

/*
 * Painel lateral de UMA aula (criar ou editar), aberto a partir da página do
 * módulo. A lista de aulas continua visível atrás — o admin não perde o lugar.
 *
 * - Vídeo: valida o link NA HORA com a mesma allowlist da tela do aluno e
 *   mostra o player. Link fora da allowlist bloqueia o salvar: antes ele era
 *   aceito e o aluno via "Video coming soon" sem o admin saber.
 * - Episódio não é campo: segue a ordem da lista (o backend renumera).
 * - Materiais já na criação: ficam na fila e sobem logo depois do POST da aula.
 */

interface Draft {
  title: string;
  description: string;
  videoUrl: string;
  duration: string;
  coverUrl: string;
  published: boolean;
}

function initialDraft(lesson: AdminLesson | null): Draft {
  return {
    title: lesson?.title ?? "",
    description: lesson?.description ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    duration: lesson?.durationSec ? formatClock(lesson.durationSec) : "",
    coverUrl: lesson?.coverUrl ?? "",
    published: lesson?.published ?? true,
  };
}

const PROVIDER_LABEL = { youtube: "YouTube", vimeo: "Vimeo" } as const;

/**
 * Prévia do vídeo no painel. Liga a API do player só para LER a duração
 * (o admin não precisa mais digitar mm:ss). Falha da API = sem auto-duração,
 * a prévia continua.
 */
function VideoPreview({
  src,
  provider,
  onDuration,
}: {
  src: string;
  provider: VideoProvider;
  onDuration: (sec: number) => void;
}) {
  const ref = useRef<HTMLIFrameElement>(null);
  const onDurationRef = useRef(onDuration);
  useEffect(() => {
    onDurationRef.current = onDuration;
  }, [onDuration]);

  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    let disposed = false;
    let handle: { destroy: () => void } | null = null;
    attachPlayer(iframe, provider, {
      onReady: (d) => {
        // Para baixo, como o próprio player mostra (213,6 s → 3:33).
        if (!disposed && d > 0) onDurationRef.current(Math.floor(d));
      },
    })
      .then((h) => {
        if (disposed) h.destroy();
        else handle = h;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      handle?.destroy();
    };
  }, [provider]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-gray-6 bg-black">
      <iframe
        ref={ref}
        src={src}
        title="Video preview"
        className="size-full"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}

export function LessonDrawer({
  moduleId,
  lesson,
  episode,
  onClose,
  onSaved,
}: {
  moduleId: string;
  /** `null` = aula nova. */
  lesson: AdminLesson | null;
  /** Número do episódio que a aula tem (ou terá) pela ordem da lista. */
  episode: number;
  onClose: () => void;
  /** Revalida a página do módulo (lista, contagens, tela do aluno). */
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(lesson));
  const [pending, setPending] = useState<MaterialPayload[]>([]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const initial = initialDraft(lesson);
  const dirty =
    pending.length > 0 ||
    (Object.keys(initial) as (keyof Draft)[]).some(
      (k) => initial[k] !== draft[k],
    );

  const [durationFromVideo, setDurationFromVideo] = useState(false);

  const video = draft.videoUrl.trim();
  // `origin` liga a API JS do player na prévia (lê a duração do vídeo).
  const embed = video
    ? toVideoEmbed(video, {
        origin: typeof window !== "undefined" ? window.location.origin : undefined,
      })
    : null;
  const videoInvalid = video !== "" && embed === null;

  // `0` = sem duração (aceito); `null` = digitou algo que não é duração.
  const durationSec = draft.duration.trim() ? parseClock(draft.duration) : 0;
  const durationInvalid = durationSec === null;

  const canSave =
    draft.title.trim().length > 0 && !videoInvalid && !durationInvalid;

  const body = () => ({
    title: draft.title.trim(),
    description: draft.description.trim(),
    videoUrl: video,
    coverUrl: draft.coverUrl.trim(),
    durationSec: durationSec ?? 0,
    published: draft.published,
    episode,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (lesson) {
        await updateLesson(lesson.id, body());
        return { failed: 0 };
      }
      const created = await createLesson(moduleId, body());
      // Um por vez, na ordem em que o admin os listou (a posição segue a
      // ordem de criação). A aula já existe: falha de anexo não a desfaz.
      let failed = 0;
      for (const m of pending) {
        try {
          await createMaterial(created.id, m);
        } catch {
          failed += 1;
        }
      }
      return { failed };
    },
    onSuccess: ({ failed }) => {
      onSaved();
      if (failed > 0) {
        toast.error(
          `Lesson saved, but ${failed} material(s) failed. Open the lesson to add them again.`,
        );
      } else {
        toast.success(lesson ? "Lesson saved." : "Lesson created.");
      }
      onClose();
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not save the lesson.")),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteLesson(lesson!.id),
    onSuccess: () => {
      onSaved();
      toast.success("Lesson deleted.");
      onClose();
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not delete the lesson.")),
  });

  /** Fechar com alterações não salvas pede confirmação — Esc é fácil de apertar. */
  const requestClose = () => {
    if (saveMut.isPending) return;
    if (dirty && !window.confirm("Discard the unsaved changes?")) return;
    onClose();
  };

  // Sem deps de propósito: o handler precisa ver o `dirty` atual.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // A página atrás não rola enquanto o painel está aberto.
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const epLabel = `EP ${String(episode).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={lesson ? `Edit lesson ${lesson.title}` : "New lesson"}
    >
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={requestClose}
        className="absolute inset-0 cursor-default bg-black/50"
      />
      <form
        className="relative flex h-full w-full max-w-[560px] flex-col border-l border-gray-6 bg-gray-2 shadow-[-30px_0_80px_0_rgba(0,0,0,0.55)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave && !saveMut.isPending) saveMut.mutate();
        }}
      >
        <header className="flex items-center gap-3 border-b border-gray-6 px-4 py-3">
          <span className="rounded-md bg-gray-4 px-2 py-1 text-xs font-semibold text-gray-12">
            {epLabel}
          </span>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-gray-12">
            {lesson ? "Edit lesson" : "New lesson"}
          </h2>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close panel"
            className="flex size-8 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
          >
            <X className="size-5" />
          </button>
        </header>

        <ScrollArea
          className="flex min-h-0 flex-1 flex-col"
          viewportClassName="min-h-0 flex-1"
        >
          <div className="flex flex-col gap-4 p-4">
            <Field label="Title">
              <input
                className={inputCls}
                value={draft.title}
                autoFocus
                onChange={(e) => set("title", e.target.value)}
                placeholder="How a Solana transaction really happens"
              />
            </Field>

            <Field label="Video link" error={
                videoInvalid
                  ? "Use an https YouTube or Vimeo link. Other links don't play for users."
                  : null
              }
              hint={
                embed ? (
                  <span className="flex items-center gap-1 text-green-11">
                    <CircleCheck className="size-3.5" />
                    {PROVIDER_LABEL[embed.provider]} video found
                  </span>
                ) : (
                  "YouTube or Vimeo (unlisted videos work). Leave empty to show “Video coming soon”."
                )
              }
            >
              <input
                className={inputCls}
                value={draft.videoUrl}
                aria-invalid={videoInvalid}
                onChange={(e) => set("videoUrl", e.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </Field>

            {embed ? (
              <VideoPreview
                key={embed.src}
                src={embed.src}
                provider={embed.provider}
                onDuration={(sec) => {
                  // Preenche só o campo VAZIO: não sobrescreve duração já
                  // salva nem o que o admin digitou.
                  setDraft((p) =>
                    p.duration.trim() ? p : { ...p, duration: formatClock(sec) },
                  );
                  setDurationFromVideo(true);
                }}
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Duration"
                error={durationInvalid ? "Use mm:ss, e.g. 14:20." : null}
                hint={
                  durationFromVideo
                    ? "Read from the video. Edit if needed."
                    : "mm:ss, shown on the card."
                }
              >
                <input
                  className={inputCls}
                  value={draft.duration}
                  aria-invalid={durationInvalid}
                  onChange={(e) => {
                    setDurationFromVideo(false);
                    set("duration", e.target.value);
                  }}
                  placeholder="14:20"
                />
              </Field>
              <label className="flex items-start gap-2 pt-6 text-sm text-gray-12">
                <input
                  type="checkbox"
                  checked={draft.published}
                  onChange={(e) => set("published", e.target.checked)}
                  className="mt-0.5 size-4 accent-principal-9"
                />
                <span>
                  Published
                  <span className="block text-xs text-gray-11">
                    Off = only admins see it.
                  </span>
                </span>
              </label>
            </div>

            <Field label="Description" hint="Optional. Shown on the lesson page.">
              <textarea
                className={textareaCls}
                value={draft.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>

            <FileDropField
              kind="cover"
              label="Cover image"
              hint="Optional. 16:9 thumbnail for the lesson card."
              value={draft.coverUrl}
              onChange={(url) => set("coverUrl", url)}
              linkPlaceholder="/mentorship/lesson-internet.webp"
            />

            <MaterialsEditor
              lessonId={lesson?.id ?? null}
              materials={lesson?.materials ?? []}
              onChanged={onSaved}
              pending={pending}
              onPendingChange={setPending}
            />
          </div>
        </ScrollArea>

        <footer className="flex items-center gap-2 border-t border-gray-6 px-4 py-3">
          {lesson ? (
            <button
              type="button"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${lesson.title}"? Everyone's progress on it goes with it.`,
                  )
                ) {
                  deleteMut.mutate();
                }
              }}
              className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-vermelho-11 transition-colors hover:bg-vermelho-3 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Delete
            </button>
          ) : null}
          <span className="flex-1" />
          {!canSave && draft.title.trim() === "" ? (
            <span className="hidden items-center gap-1 text-xs text-gray-11 sm:flex">
              <CircleAlert className="size-3.5" />
              Title is required
            </span>
          ) : null}
          <button type="button" onClick={requestClose} className={secondaryBtnCls}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || saveMut.isPending}
            className={primaryBtnCls}
          >
            {saveMut.isPending
              ? "Saving…"
              : lesson
                ? "Save lesson"
                : "Create lesson"}
          </button>
        </footer>
      </form>
    </div>
  );
}
