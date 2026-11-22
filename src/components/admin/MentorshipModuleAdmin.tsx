"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Paperclip,
  Plus,
  Trash2,
} from "lucide-react";

import { FileDropField } from "@/components/admin/FileDropField";
import { LessonDrawer } from "@/components/admin/LessonDrawer";
import {
  AdminGate,
  DragHandle,
  Field,
  inputCls,
  moduleVisibility,
  primaryBtnCls,
  secondaryBtnCls,
  slugify,
  slugifyLoose,
  StatusBadge,
  textareaCls,
  VisibilityBadge,
} from "@/components/admin/MentorshipAdminUi";
import {
  useDragReorder,
  type DragHandleProps,
  type DragItemProps,
} from "@/components/admin/useDragReorder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";
import { getAdminErrorMessage } from "@/lib/api/client";
import {
  ADMIN_CATEGORIES_KEY,
  adminModuleKey,
  deleteModule,
  getAdminModule,
  listAdminCategories,
  MENTORSHIP_OVERVIEW_KEY,
  reorderLessons,
  updateModule,
  type AdminCategory,
  type AdminLesson,
  type AdminModuleDetail,
  type MentorshipAccent,
  type ModulePayload,
} from "@/lib/api/mentorship";
import { cn } from "@/lib/cn";
import { formatClock, formatDurationShort } from "@/lib/mentorship/format";
import { toVideoEmbed } from "@/lib/mentorship/video";

const ADMIN_HOME = "/admin/mentorship";

/** Acentos oferecidos no formulário — espelha o enum do backend. */
const ACCENTS: { value: MentorshipAccent; label: string }[] = [
  { value: "PRINCIPAL", label: "Yellow (brand)" },
  { value: "GREEN", label: "Green" },
  { value: "AZUL", label: "Cyan" },
  { value: "VIOLETA", label: "Violet" },
];

/*
 * Página de UM módulo no admin (`/admin/mentorship/modules/[id]`).
 *
 * Substitui o modal antigo, onde a aula ficava num formulário dentro de outro
 * formulário dentro de um modal. Aqui:
 * - breadcrumb Mentorship › Categoria › Módulo (sempre se sabe onde está);
 * - aulas em lista larga, arrastáveis, cada uma com o que falta (sem vídeo,
 *   rascunho) visível sem abrir nada;
 * - a aula abre num painel lateral (`LessonDrawer`) por cima da lista;
 * - dados do módulo na coluna da direita, salvos só quando mudam;
 * - publicar é UM botão no topo, com o aviso de quando ele não basta
 *   (categoria em rascunho).
 */
export function MentorshipModuleAdmin({ moduleId }: { moduleId: string }) {
  return (
    <AdminGate>
      <ModulePage moduleId={moduleId} />
    </AdminGate>
  );
}

function ModulePage({ moduleId }: { moduleId: string }) {
  const qc = useQueryClient();
  const router = useRouter();

  const moduleQuery = useQuery({
    queryKey: adminModuleKey(moduleId),
    queryFn: () => getAdminModule(moduleId),
    retry: false,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ADMIN_CATEGORIES_KEY,
    queryFn: listAdminCategories,
  });

  /** `undefined` = fechado; `null` = aula nova. */
  const [drawerLesson, setDrawerLesson] = useState<
    AdminLesson | null | undefined
  >(undefined);

  const afterWrite = () => {
    qc.invalidateQueries({ queryKey: adminModuleKey(moduleId) });
    qc.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY });
    qc.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
  };

  const publishMut = useMutation({
    mutationFn: (published: boolean) => updateModule(moduleId, { published }),
    onSuccess: (_d, published) => {
      afterWrite();
      toast.success(published ? "Module published." : "Module unpublished.");
    },
    onError: (e) =>
      toast.error(getAdminErrorMessage(e, "Could not change the status.")),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteModule(moduleId),
    onSuccess: () => {
      afterWrite();
      toast.success("Module deleted.");
      router.push(ADMIN_HOME);
    },
    onError: (e) =>
      toast.error(getAdminErrorMessage(e, "Could not delete the module.")),
  });

  if (moduleQuery.isLoading) {
    return (
      <SkeletonGroup className="flex flex-col gap-6">
        <Skeleton className="h-5 w-64 rounded" />
        <Skeleton className="h-20 rounded-xl bg-gray-2" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-96 rounded-xl bg-gray-2" />
          <Skeleton className="h-96 rounded-xl bg-gray-2" />
        </div>
      </SkeletonGroup>
    );
  }

  const m = moduleQuery.data;
  if (!m) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-gray-6 bg-gray-2 p-6">
        <h1 className="text-lg font-semibold text-gray-12">Module not found</h1>
        <p className="text-sm text-gray-11">
          It may have been deleted in another tab.
        </p>
        <Link href={ADMIN_HOME} className={secondaryBtnCls}>
          <ChevronLeft className="size-4" />
          Back to mentorship
        </Link>
      </div>
    );
  }

  const category = categories.find((c) => c.id === m.categoryId);
  const categoryPublished = category?.published ?? true;
  const visibility = moduleVisibility(m.published, categoryPublished);
  const publishedLessons = m.lessons.filter((l) => l.published).length;
  const totalSec = m.lessons.reduce((n, l) => n + l.durationSec, 0);

  const togglePublish = () => {
    if (
      !m.published &&
      publishedLessons === 0 &&
      !window.confirm(
        "This module has no published lessons yet. Users will see an empty module. Publish anyway?",
      )
    ) {
      return;
    }
    publishMut.mutate(!m.published);
  };

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-gray-11">
          <li>
            <Link href={ADMIN_HOME} className="hover:text-gray-12 hover:underline">
              Mentorship
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li>{category?.title ?? "…"}</li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li aria-current="page" className="font-semibold text-gray-12">
            {m.title}
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-6 bg-gray-2 p-4">
        <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-gray-3">
          {m.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={m.coverUrl} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-gray-12">
              {m.title}
            </h1>
            {m.label ? (
              <span className="text-sm text-gray-11">{m.label}</span>
            ) : null}
            {visibility === "visible" ? (
              <StatusBadge tone="success">Live</StatusBadge>
            ) : (
              <VisibilityBadge
                modulePublished={m.published}
                categoryPublished={categoryPublished}
              />
            )}
          </div>
          <span className="text-xs text-gray-11">
            {m.lessons.length} {m.lessons.length === 1 ? "lesson" : "lessons"}
            {totalSec > 0 ? ` · ${formatDurationShort(totalSec)}` : ""} ·
            /mentorship/{m.slug}
          </span>
          {visibility === "hidden-by-category" ? (
            <span className="text-xs text-laranja-11">
              Published, but the category “{category?.title}” is a draft —
              publish the category to make it visible.
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {visibility === "visible" ? (
            <a
              href={`/mentorship/${m.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryBtnCls}
            >
              <ExternalLink className="size-4" />
              View on site
            </a>
          ) : null}
          <button
            type="button"
            onClick={togglePublish}
            disabled={publishMut.isPending}
            className={m.published ? secondaryBtnCls : primaryBtnCls}
          >
            {m.published ? "Unpublish" : "Publish module"}
          </button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <LessonsSection
          module={m}
          onOpen={(lesson) => setDrawerLesson(lesson)}
          onReordered={afterWrite}
        />

        <div className="flex flex-col gap-6">
          <ModuleDetailsForm
            key={m.id}
            module={m}
            categories={categories}
            onSaved={afterWrite}
          />

          <section className="flex flex-col gap-2 rounded-xl border border-vermelho-7/40 p-4">
            <h2 className="text-sm font-semibold text-gray-12">Delete module</h2>
            <p className="text-xs text-gray-11">
              Removes its {m.lessons.length} lesson(s) and everyone&apos;s
              progress on them. This cannot be undone.
            </p>
            <button
              type="button"
              disabled={deleteMut.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Delete "${m.title}"? Its ${m.lessons.length} lesson(s) and everyone's progress on them go with it.`,
                  )
                ) {
                  deleteMut.mutate();
                }
              }}
              className="flex h-9 items-center justify-center gap-1.5 self-start rounded-lg border border-vermelho-7/60 px-3 text-sm font-semibold text-vermelho-11 transition-colors hover:bg-vermelho-3 disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              Delete module
            </button>
          </section>
        </div>
      </div>

      {drawerLesson !== undefined ? (
        <LessonDrawer
          key={drawerLesson?.id ?? "new"}
          moduleId={m.id}
          lesson={drawerLesson}
          episode={
            drawerLesson
              ? m.lessons.findIndex((l) => l.id === drawerLesson.id) + 1
              : m.lessons.length + 1
          }
          onClose={() => setDrawerLesson(undefined)}
          onSaved={afterWrite}
        />
      ) : null}
    </div>
  );
}

// ── Aulas ─────────────────────────────────────────────────────────────────────

function LessonsSection({
  module: m,
  onOpen,
  onReordered,
}: {
  module: AdminModuleDetail;
  onOpen: (lesson: AdminLesson | null) => void;
  onReordered: () => void;
}) {
  const reorderMut = useMutation({
    mutationFn: (ids: string[]) => reorderLessons(m.id, ids),
    onSuccess: onReordered,
    onError: (e) => toast.error(getAdminErrorMessage(e, "Could not reorder.")),
  });
  // `mutateAsync`: se falhar, o hook desfaz a ordem otimista sozinho.
  const order = useDragReorder(m.lessons, (ids) => reorderMut.mutateAsync(ids));

  return (
    <section
      aria-label="Lessons"
      className="flex flex-col gap-3 rounded-xl border border-gray-6 bg-gray-1 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-semibold text-gray-12">
            Lessons{" "}
            <span className="font-normal text-gray-11">
              ({m.lessons.length})
            </span>
          </h2>
          <span className="text-xs text-gray-11">
            Drag to reorder. Episode numbers follow the order.
          </span>
        </div>
        <button
          type="button"
          onClick={() => onOpen(null)}
          className={primaryBtnCls}
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Add lesson
        </button>
      </div>

      {m.lessons.length === 0 ? (
        <button
          type="button"
          onClick={() => onOpen(null)}
          className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-gray-6 p-8 text-center transition-colors hover:border-gray-8"
        >
          <span className="text-sm font-semibold text-gray-12">
            No lessons yet
          </span>
          <span className="text-xs text-gray-11">
            Add the first one. You only need a title and a YouTube or Vimeo
            link.
          </span>
        </button>
      ) : (
        <ol className="flex flex-col gap-2">
          {order.ordered.map((l, index) => (
            <LessonRow
              key={l.id}
              lesson={l}
              episode={index + 1}
              itemProps={order.itemProps(l.id)}
              handleProps={order.handleProps(l.id)}
              dragging={order.draggingId === l.id}
              reordering={reorderMut.isPending}
              onOpen={() => onOpen(l)}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function LessonRow({
  lesson: l,
  episode,
  itemProps,
  handleProps,
  dragging,
  reordering,
  onOpen,
}: {
  lesson: AdminLesson;
  episode: number;
  itemProps: DragItemProps;
  handleProps: DragHandleProps;
  dragging: boolean;
  reordering: boolean;
  onOpen: () => void;
}) {
  const embed = l.videoUrl ? toVideoEmbed(l.videoUrl) : null;
  const meta = [
    l.durationSec > 0 ? formatClock(l.durationSec) : null,
    embed ? (embed.provider === "youtube" ? "YouTube" : "Vimeo") : null,
    l.materials.length > 0
      ? `${l.materials.length} ${l.materials.length === 1 ? "material" : "materials"}`
      : null,
  ].filter(Boolean);

  return (
    <li
      {...itemProps}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 p-2 transition-opacity",
        dragging && "opacity-50",
      )}
    >
      <DragHandle label={l.title} disabled={reordering} {...handleProps} />
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Edit lesson ${l.title}`}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/40"
      >
        <span className="w-11 shrink-0 text-center text-xs font-semibold text-gray-11">
          EP {String(episode).padStart(2, "0")}
        </span>
        <div className="hidden h-9 w-16 shrink-0 overflow-hidden rounded bg-gray-3 sm:block">
          {l.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={l.coverUrl}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-semibold text-gray-12 group-hover:underline">
            {l.title}
          </span>
          <span className="flex items-center gap-1 truncate text-xs text-gray-11">
            {meta.join(" · ")}
            {l.materials.length > 0 ? (
              <Paperclip className="size-3" aria-hidden />
            ) : null}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {!l.published ? <StatusBadge>Draft</StatusBadge> : null}
          {!l.videoUrl ? (
            <StatusBadge tone="warning">No video</StatusBadge>
          ) : !embed ? (
            <StatusBadge tone="warning">Video link invalid</StatusBadge>
          ) : null}
          <ChevronRight className="size-4 text-gray-11" aria-hidden />
        </div>
      </button>
    </li>
  );
}

// ── Dados do módulo ──────────────────────────────────────────────────────────

type Details = Omit<ModulePayload, "published">;

function detailsOf(m: AdminModuleDetail): Details {
  return {
    categoryId: m.categoryId,
    title: m.title,
    slug: m.slug,
    label: m.label,
    subtitle: m.subtitle,
    coverUrl: m.coverUrl,
    accent: m.accent,
  };
}

function ModuleDetailsForm({
  module: m,
  categories,
  onSaved,
}: {
  module: AdminModuleDetail;
  categories: AdminCategory[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Details>(() => detailsOf(m));
  const set = <K extends keyof Details>(k: K, v: Details[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  // Compara com o que está NO SERVIDOR (não com o rascunho inicial): depois de
  // salvar e o refetch chegar, o botão volta a "nada para salvar" sozinho.
  const saved = detailsOf(m);
  const changed = (Object.keys(saved) as (keyof Details)[]).filter(
    (k) => saved[k] !== draft[k],
  );
  const dirty = changed.length > 0;
  const canSave = dirty && draft.title.trim() !== "" && slugify(draft.slug) !== "";

  const saveMut = useMutation({
    mutationFn: () => {
      // Só os campos que mudaram: trocar a categoria MOVE o módulo, e mandar
      // `categoryId` sem querer o empurraria para o fim da lista.
      const patch: Partial<ModulePayload> = {};
      for (const k of changed) {
        const v = k === "slug" ? slugify(draft.slug) : k === "title" ? draft.title.trim() : draft[k];
        Object.assign(patch, { [k]: v });
      }
      return updateModule(m.id, patch);
    },
    onSuccess: () => {
      onSaved();
      toast.success("Module saved.");
    },
    onError: (e) =>
      toast.error(getAdminErrorMessage(e, "Could not save the module.")),
  });

  return (
    <form
      aria-label="Module details"
      className="flex flex-col gap-4 rounded-xl border border-gray-6 bg-gray-1 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !saveMut.isPending) saveMut.mutate();
      }}
    >
      <h2 className="text-base font-semibold text-gray-12">Module details</h2>

      <Field
        label="Category"
        hint={
          draft.categoryId !== m.categoryId
            ? "Saving moves the module to the end of that category."
            : undefined
        }
      >
        <Select
          value={draft.categoryId}
          onValueChange={(v) => set("categoryId", v)}
        >
          <SelectTrigger aria-label="Category">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.published ? c.title : `${c.title} (draft)`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Title">
        <input
          className={inputCls}
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
        />
      </Field>

      <Field
        label="Slug"
        hint={
          draft.slug !== m.slug
            ? "Changing it breaks links already shared."
            : `URL: /mentorship/${m.slug}`
        }
      >
        <input
          className={inputCls}
          value={draft.slug}
          onChange={(e) => set("slug", slugifyLoose(e.target.value))}
          onBlur={(e) => set("slug", slugify(e.target.value))}
        />
      </Field>

      <Field label="Label" hint='Small badge next to the title, e.g. "Module 1".'>
        <input
          className={inputCls}
          value={draft.label}
          onChange={(e) => set("label", e.target.value)}
          placeholder="Module 1"
        />
      </Field>

      <Field label="Subtitle" hint="One sentence on the module card.">
        <textarea
          className={textareaCls}
          value={draft.subtitle}
          onChange={(e) => set("subtitle", e.target.value)}
          placeholder="What this module covers."
        />
      </Field>

      <FileDropField
        kind="cover"
        label="Cover image"
        hint="Shown on the module card. Webp or png around 800×1000 works best."
        value={draft.coverUrl}
        onChange={(url) => set("coverUrl", url)}
        linkPlaceholder="/mentorship/module-market.webp"
      />

      <Field label="Progress colour">
        <Select
          value={draft.accent}
          onValueChange={(v) => set("accent", v as MentorshipAccent)}
        >
          <SelectTrigger aria-label="Progress colour">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACCENTS.map((a) => (
              <SelectItem key={a.value} value={a.value}>
                {a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="flex items-center justify-end gap-2">
        {dirty ? (
          <button
            type="button"
            onClick={() => setDraft(detailsOf(m))}
            className={secondaryBtnCls}
          >
            Discard
          </button>
        ) : null}
        <button
          type="submit"
          disabled={!canSave || saveMut.isPending}
          className={primaryBtnCls}
        >
          {saveMut.isPending ? "Saving…" : dirty ? "Save details" : "Saved"}
        </button>
      </div>
    </form>
  );
}
