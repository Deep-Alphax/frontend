"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { MaterialsEditor } from "@/components/admin/MaterialsEditor";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { getApiErrorMessage } from "@/lib/api/client";
import {
  ADMIN_MODULES_KEY,
  adminModuleKey,
  createLesson,
  deleteLesson,
  getAdminModule,
  MENTORSHIP_OVERVIEW_KEY,
  reorderLessons,
  updateLesson,
  type AdminLesson,
  type LessonPayload,
} from "@/lib/api/mentorship";
import { formatClock, parseClock } from "@/lib/mentorship/format";
import { cn } from "@/lib/cn";
import { ScrollArea } from "@/components/ui/ScrollArea";

const inputCls =
  "h-10 w-full rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">
        {label}
      </span>
      {children}
      {hint ? <span className="text-xs text-gray-11">{hint}</span> : null}
    </label>
  );
}

/*
 * Aulas de UMA trilha, dentro do editor do admin.
 *
 * A lista vem de uma query própria (`adminModuleKey`), não de um recorte da
 * listagem: a listagem não carrega aulas, e derivar uma da outra deixaria as
 * duas com verdades diferentes depois de um PATCH.
 */
export function MentorshipLessonsPanel({ moduleId }: { moduleId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdminLesson | null>(null);
  const [creating, setCreating] = useState(false);

  /**
   * `gcTime: 0` + `staleTime: 0`: o formulário é semeado a partir DESTA query e
   * o Salvar manda todos os campos. Se ela pudesse servir cache velho, o
   * rascunho nasceria velho e regravaria o valor antigo por cima do PATCH que
   * acabou de entrar.
   */
  const { data, isLoading } = useQuery({
    queryKey: adminModuleKey(moduleId),
    queryFn: () => getAdminModule(moduleId),
    gcTime: 0,
    staleTime: 0,
  });

  const lessons = data?.lessons ?? [];

  const afterWrite = () => {
    qc.invalidateQueries({ queryKey: adminModuleKey(moduleId) });
    qc.invalidateQueries({ queryKey: ADMIN_MODULES_KEY });
    qc.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
  };

  const createMut = useMutation({
    mutationFn: (payload: LessonPayload) => createLesson(moduleId, payload),
    onSuccess: () => {
      setCreating(false);
      afterWrite();
      toast.success("Lesson added.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not add the lesson.")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<LessonPayload>;
    }) => updateLesson(id, patch),
    onSuccess: () => {
      setEditing(null);
      afterWrite();
      toast.success("Lesson saved.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not save the lesson.")),
  });

  const deleteMut = useMutation({
    mutationFn: deleteLesson,
    onSuccess: () => {
      afterWrite();
      toast.success("Lesson deleted.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not delete the lesson.")),
  });

  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderLessons(moduleId, ids),
    onSuccess: afterWrite,
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not reorder.")),
  });

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= lessons.length) return;
    const ids = lessons.map((l) => l.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMut.mutate(ids);
  };

  // Um formulário aberto substitui a lista: no espaço de meia coluna, os dois
  // ao mesmo tempo brigariam por rolagem.
  if (creating || editing) {
    return (
      <LessonForm
        key={editing?.id ?? "new"}
        lesson={editing}
        onMaterialsChanged={afterWrite}
        nextEpisode={lessons.length + 1}
        saving={createMut.isPending || updateMut.isPending}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSubmit={(payload) =>
          editing
            ? updateMut.mutate({ id: editing.id, patch: payload })
            : createMut.mutate(payload)
        }
      />
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:border-l lg:border-gray-6 lg:pl-6">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-12">
          Lessons{" "}
          <span className="font-normal text-gray-11">({lessons.length})</span>
        </h3>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex h-8 items-center gap-1.5 rounded-md border border-gray-6 px-3 text-xs font-semibold text-gray-12 transition-colors hover:bg-gray-3"
        >
          <Plus className="size-3.5" strokeWidth={2.5} />
          Add lesson
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-lg bg-gray-3" aria-hidden />
      ) : null}

      <ScrollArea viewportClassName="max-h-[420px]">
        <ul className="flex flex-col gap-2 pr-3">
          {lessons.map((l, index) => (
            <li
              key={l.id}
              className="flex items-center gap-3 rounded-lg border border-gray-6 bg-gray-1 p-2"
            >
              <span className="w-10 shrink-0 text-center text-xs font-semibold text-gray-11">
                EP {String(l.episode).padStart(2, "0")}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-gray-12">{l.title}</span>
                <span className="text-xs text-gray-11">
                  {formatClock(l.durationSec)}
                  {!l.published ? " · draft" : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <SmallButton
                  label="Move up"
                  disabled={index === 0 || reorderMut.isPending}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-3.5" />
                </SmallButton>
                <SmallButton
                  label="Move down"
                  disabled={index === lessons.length - 1 || reorderMut.isPending}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-3.5" />
                </SmallButton>
                <SmallButton label="Edit lesson" onClick={() => setEditing(l)}>
                  <Pencil className="size-3.5" />
                </SmallButton>
                <SmallButton
                  label="Delete lesson"
                  danger
                  disabled={deleteMut.isPending}
                  onClick={() => {
                    const ok = window.confirm(
                      `Delete "${l.title}"? Everyone's progress on it goes with it.`,
                    );
                    if (ok) deleteMut.mutate(l.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </SmallButton>
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>

      {!isLoading && lessons.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-6 p-4 text-center text-xs text-gray-11">
          No lessons in this track yet.
        </p>
      ) : null}
    </div>
  );
}

function SmallButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md border border-gray-6 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-40",
        danger && "hover:border-vermelho-8 hover:text-vermelho-11",
      )}
    >
      {children}
    </button>
  );
}

/** Formulário de uma aula. A duração é digitada como `mm:ss`, não em segundos. */
function LessonForm({
  lesson,
  nextEpisode,
  saving,
  onCancel,
  onSubmit,
  onMaterialsChanged,
}: {
  lesson: AdminLesson | null;
  nextEpisode: number;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: LessonPayload) => void;
  /** Revalida a trilha depois de anexar/remover material. */
  onMaterialsChanged: () => void;
}) {
  const [draft, setDraft] = useState(() => ({
    title: lesson?.title ?? "",
    description: lesson?.description ?? "",
    episode: lesson?.episode ?? nextEpisode,
    coverUrl: lesson?.coverUrl ?? "",
    videoUrl: lesson?.videoUrl ?? "",
    published: lesson?.published ?? true,
  }));
  const [duration, setDuration] = useState(() =>
    lesson?.durationSec ? formatClock(lesson.durationSec) : "",
  );

  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  // `null` distingue "não escreveu nada" (aceito: aula sem duração) de "escreveu
  // algo que não é duração" (bloqueia o Salvar).
  const parsed = duration.trim() ? parseClock(duration) : 0;
  const durationInvalid = parsed === null;
  const canSave = draft.title.trim().length > 0 && !durationInvalid;

  return (
    <form
      className="flex min-w-0 flex-col gap-4 lg:border-l lg:border-gray-6 lg:pl-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSave) return;
        onSubmit({
          ...draft,
          title: draft.title.trim(),
          durationSec: parsed ?? 0,
        });
      }}
    >
      <h3 className="text-sm font-semibold text-gray-12">
        {lesson ? "Edit lesson" : "New lesson"}
      </h3>

      <Field label="Title">
        <input
          className={inputCls}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="How a Solana transaction really happens"
        />
      </Field>

      <Field label="Description">
        <textarea
          className={cn(inputCls, "h-20 resize-none py-2")}
          value={draft.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Episode">
          <input
            type="number"
            min={0}
            max={999}
            className={inputCls}
            value={draft.episode}
            onChange={(e) => set("episode", Number(e.target.value))}
          />
        </Field>
        <Field
          label="Duration"
          hint={durationInvalid ? "Use mm:ss (e.g. 14:20)." : "mm:ss"}
        >
          <input
            className={cn(inputCls, durationInvalid && "border-vermelho-8")}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="14:20"
            aria-invalid={durationInvalid}
          />
        </Field>
      </div>

      <Field label="Cover URL">
        <input
          className={inputCls}
          value={draft.coverUrl}
          onChange={(e) => set("coverUrl", e.target.value)}
          placeholder="/mentorship/lesson-internet.webp"
        />
      </Field>

      <Field label="Video URL">
        <input
          className={inputCls}
          value={draft.videoUrl}
          onChange={(e) => set("videoUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-12">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) => set("published", e.target.checked)}
          className="size-4 accent-principal-9"
        />
        Published
      </label>

      <MaterialsEditor
        lessonId={lesson?.id ?? null}
        materials={lesson?.materials ?? []}
        onChanged={onMaterialsChanged}
      />

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-gray-6 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-3"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave || saving}
          className="h-10 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save lesson"}
        </button>
      </div>
    </form>
  );
}
