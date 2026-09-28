"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MentorshipStats } from "@/components/admin/MentorshipStats";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";

import { MentorshipLessonsPanel } from "@/components/admin/MentorshipLessonsPanel";
import { Modal } from "@/components/walletReader/Modal";
import { getApiErrorMessage } from "@/lib/api/client";
import {
  ADMIN_MODULES_KEY,
  adminModuleKey,
  createModule,
  deleteModule,
  listAdminModules,
  MENTORSHIP_OVERVIEW_KEY,
  reorderModules,
  updateModule,
  type AdminModuleSummary,
  type MentorshipAccent,
  type ModulePayload,
} from "@/lib/api/mentorship";
import { useSession } from "@/lib/auth/useSession";
import { cn } from "@/lib/cn";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/** Acentos oferecidos no formulário — espelha o enum do backend. */
const ACCENTS: { value: MentorshipAccent; label: string }[] = [
  { value: "PRINCIPAL", label: "Yellow (brand)" },
  { value: "GREEN", label: "Green" },
  { value: "AZUL", label: "Cyan" },
  { value: "VIOLETA", label: "Violet" },
];

const inputCls =
  "h-10 w-full rounded-lg border border-gray-6 bg-gray-1 px-3 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus-visible:border-secundaria-11/60";

/** Campo rotulado — mesmo formato do editor de KOLs. */
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

/**
 * Base do slug: sem acento, minúsculo, com hífen no lugar do resto. Não apara a
 * ponta direita — quem faz isso é `slugify`.
 */
function slugifyLoose(value: string): string {
  return (
    value
      .normalize("NFD")
      // Tira os diacríticos que o NFD acabou de separar ("ç" → "c", "ã" → "a").
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+/, "")
      .slice(0, 80)
  );
}

/**
 * `"On-chain fundamentals"` → `"on-chain-fundamentals"`.
 *
 * Aplicada quando o campo perde o foco, NUNCA a cada tecla: aparar o hífen
 * final durante a digitação o apagaria no instante em que é digitado, e ninguém
 * conseguiria escrever "my-url" (sairia "myurl").
 */
function slugify(value: string): string {
  return slugifyLoose(value).replace(/-+$/, "");
}

function emptyModule(): ModulePayload {
  return {
    slug: "",
    title: "",
    subtitle: "",
    label: "",
    coverUrl: "",
    accent: "PRINCIPAL",
    published: true,
  };
}

/*
 * Admin da Mentoria: cria, edita, ordena e publica trilhas e aulas.
 *
 * O que muda aqui muda a tela de TODO usuário — por isso o gate de papel é o
 * mesmo do preset de KOLs, e a autoridade real continua sendo o `AdminGuard` do
 * backend (esta checagem é só para não mostrar formulário que vai levar 403).
 */
export function MentorshipAdmin() {
  const qc = useQueryClient();
  const { profile, isAuthenticated, isLoading: loadingSession } = useSession();

  const [editing, setEditing] = useState<AdminModuleSummary | null>(null);
  const [creating, setCreating] = useState(false);
  // Abas em estado local: o admin entra por "Content" quase sempre, e um
  // parâmetro de URL para isto não paga a complexidade.
  const [tab, setTab] = useState<"content" | "usage">("content");

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ADMIN_MODULES_KEY,
    queryFn: listAdminModules,
    enabled: profile?.role === "ADMIN",
  });

  /**
   * Toda escrita invalida TRÊS caches: a listagem do admin, o detalhe da trilha
   * aberta e a tela pública. Chaves diferentes não se alcançam por prefixo —
   * esquecer uma delas é o que faz a edição "sumir" ao reabrir o editor.
   */
  const afterWrite = (moduleId?: string) => {
    qc.invalidateQueries({ queryKey: ADMIN_MODULES_KEY });
    qc.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
    if (moduleId) qc.invalidateQueries({ queryKey: adminModuleKey(moduleId) });
  };

  const createMut = useMutation({
    mutationFn: createModule,
    onSuccess: () => {
      setCreating(false);
      afterWrite();
      toast.success("Track created.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not create the track.")),
  });

  const updateMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<ModulePayload>;
    }) => updateModule(id, patch),
    onSuccess: (_data, vars) => {
      setEditing(null);
      afterWrite(vars.id);
      toast.success("Track saved.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not save the track.")),
  });

  const deleteMut = useMutation({
    mutationFn: deleteModule,
    onSuccess: () => {
      afterWrite();
      toast.success("Track deleted.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not delete the track.")),
  });

  const reorderMut = useMutation({
    mutationFn: reorderModules,
    onSuccess: () => afterWrite(),
    onError: (e) => toast.error(getApiErrorMessage(e, "Could not reorder.")),
  });

  /** Troca a trilha de lugar com a vizinha e manda a lista inteira na nova ordem. */
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= modules.length) return;
    const ids = modules.map((m) => m.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMut.mutate(ids);
  };

  if (loadingSession) {
    return (
      <div className="h-40 animate-pulse rounded-lg bg-gray-2" aria-hidden />
    );
  }
  if (!isAuthenticated) {
    return <p className="text-gray-11">Sign in to continue.</p>;
  }
  if (profile?.role !== "ADMIN") {
    return (
      <div className="rounded-lg border border-gray-6 bg-gray-2 p-6">
        <h1 className="text-lg font-semibold text-gray-12">
          Restricted access
        </h1>
        <p className="text-sm text-gray-11">This area is admins only.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-12">Mentorship</h1>
        <p className="text-sm text-gray-11">
          Tracks and lessons shown on{" "}
          <b className="text-gray-12">/mentorship</b>. Unpublished items stay
          visible here and nowhere else.
        </p>
      </header>

      <div className="flex items-center gap-1 border-b border-gray-6">
        {(["content", "usage"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors " +
              (tab === t
                ? "border-principal-9 text-gray-12"
                : "border-transparent text-gray-11 hover:text-gray-12")
            }
          >
            {t === "content" ? "Content" : "Usage"}
          </button>
        ))}
      </div>

      {tab === "usage" ? <MentorshipStats /> : null}

      {tab === "content" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-gray-11">
              {modules.length} {modules.length === 1 ? "track" : "tracks"}
            </span>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex h-10 items-center gap-2 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
            >
              <Plus className="size-4" strokeWidth={2.5} />
              New track
            </button>
          </div>

          {isLoading ? (
            <SkeletonGroup className="flex flex-col gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg bg-gray-2" />
              ))}
            </SkeletonGroup>
          ) : null}

          <ul className="flex flex-col gap-2">
            {modules.map((m, index) => (
              <li
                key={m.id}
                className="flex items-center gap-4 rounded-lg border border-gray-6 bg-gray-2 p-3"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-md bg-gray-3">
                  {m.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.coverUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold text-gray-12">
                      {m.title}
                    </span>
                    {m.label ? (
                      <span className="shrink-0 text-xs text-gray-11">
                        {m.label}
                      </span>
                    ) : null}
                    {!m.published ? (
                      <span className="shrink-0 rounded-full border border-gray-6 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-11">
                        Draft
                      </span>
                    ) : null}
                  </div>
                  <span className="truncate text-xs text-gray-11">
                    /{m.slug} · {m.lessonCount}{" "}
                    {m.lessonCount === 1 ? "lesson" : "lessons"}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={`Move ${m.title} up`}
                    disabled={index === 0 || reorderMut.isPending}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Move ${m.title} down`}
                    disabled={
                      index === modules.length - 1 || reorderMut.isPending
                    }
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Edit ${m.title}`}
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="size-4" />
                  </IconButton>
                  <IconButton
                    label={`Delete ${m.title}`}
                    danger
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      // Cascata apaga as aulas e o progresso de todo mundo — por
                      // isso a confirmação diz exatamente o que vai embora.
                      const ok = window.confirm(
                        `Delete "${m.title}"? Its ${m.lessonCount} lesson(s) and everyone's progress on them go with it.`,
                      );
                      if (ok) deleteMut.mutate(m.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </li>
            ))}
          </ul>

          {!isLoading && modules.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-6 p-6 text-center text-sm text-gray-11">
              No tracks yet. Create the first one to fill the mentorship page.
            </p>
          ) : null}
        </>
      ) : null}

      {/* Os editores ficam FORA da aba: um modal aberto não deve sumir
          porque a aba mudou por baixo dele. */}
      <ModuleEditor
        open={creating}
        module={null}
        saving={createMut.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(payload) => createMut.mutate(payload)}
      />

      <ModuleEditor
        open={editing !== null}
        module={editing}
        saving={updateMut.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(patch) =>
          editing && updateMut.mutate({ id: editing.id, patch })
        }
      />
    </div>
  );
}

function IconButton({
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
        "flex size-8 items-center justify-center rounded-md border border-gray-6 text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12 disabled:cursor-not-allowed disabled:opacity-40",
        danger && "hover:border-vermelho-8 hover:text-vermelho-11",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Formulário da trilha. Ao editar, a coluna da direita traz as aulas — evita o
 * modal dentro de modal, que é onde esse tipo de tela costuma travar.
 */
function ModuleEditor({
  open,
  module: m,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  module: AdminModuleSummary | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ModulePayload) => void;
}) {
  // `key` remonta o formulário quando a trilha muda: sem isso o rascunho do
  // `useState` sobreviveria à troca de trilha e salvaria o texto da anterior.
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={m ? `Edit — ${m.title}` : "New track"}
      className={m ? "max-w-5xl" : "max-w-lg"}
    >
      <ModuleForm
        key={m?.id ?? "new"}
        module={m}
        saving={saving}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function ModuleForm({
  module: m,
  saving,
  onClose,
  onSubmit,
}: {
  module: AdminModuleSummary | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: ModulePayload) => void;
}) {
  const [draft, setDraft] = useState<ModulePayload>(() =>
    m
      ? {
          slug: m.slug,
          title: m.title,
          subtitle: m.subtitle,
          label: m.label,
          coverUrl: m.coverUrl,
          accent: m.accent,
          published: m.published,
        }
      : emptyModule(),
  );
  // O slug segue o título só até alguém digitá-lo à mão — depois disso, mexer
  // no título não pode mais reescrever uma URL possivelmente já compartilhada.
  const [slugTouched, setSlugTouched] = useState(Boolean(m));

  const set = <K extends keyof ModulePayload>(k: K, v: ModulePayload[K]) =>
    setDraft((p) => ({ ...p, [k]: v }));

  const canSave = draft.title.trim().length > 0 && draft.slug.trim().length > 0;

  return (
    <div className={cn("grid gap-6 p-4", m && "lg:grid-cols-2")}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Normaliza o slug também aqui: submeter por Enter não passa pelo blur.
          if (canSave) {
            onSubmit({
              ...draft,
              title: draft.title.trim(),
              slug: slugify(draft.slug),
            });
          }
        }}
      >
        <Field label="Title">
          <input
            className={inputCls}
            value={draft.title}
            onChange={(e) => {
              const title = e.target.value;
              setDraft((p) => ({
                ...p,
                title,
                slug: slugTouched ? p.slug : slugify(title),
              }));
            }}
            placeholder="On-chain fundamentals"
          />
        </Field>

        <Field
          label="Slug"
          hint="Used in the URL. Changing it breaks old links."
        >
          <input
            className={inputCls}
            value={draft.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", slugifyLoose(e.target.value));
            }}
            onBlur={(e) => set("slug", slugify(e.target.value))}
            placeholder="on-chain-fundamentals"
          />
        </Field>

        <Field
          label="Label"
          hint='Short badge next to the title, e.g. "Module 1".'
        >
          <input
            className={inputCls}
            value={draft.label}
            onChange={(e) => set("label", e.target.value)}
            placeholder="Module 1"
          />
        </Field>

        <Field label="Subtitle">
          <textarea
            className={cn(inputCls, "h-20 resize-none py-2")}
            value={draft.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="What this track covers, in one sentence."
          />
        </Field>

        <Field
          label="Cover URL"
          hint="Full https URL or a path like /mentorship/module-market.webp"
        >
          <input
            className={inputCls}
            value={draft.coverUrl}
            onChange={(e) => set("coverUrl", e.target.value)}
            placeholder="/mentorship/module-market.webp"
          />
        </Field>

        <Field label="Progress colour">
          <select
            className={inputCls}
            value={draft.accent}
            onChange={(e) => set("accent", e.target.value as MentorshipAccent)}
          >
            {ACCENTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>

        <label className="flex items-center gap-2 text-sm text-gray-12">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) => set("published", e.target.checked)}
            className="size-4 accent-principal-9"
          />
          Published (visible to users)
        </label>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-gray-6 px-4 text-sm font-semibold text-gray-12 transition-colors hover:bg-gray-3"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave || saving}
            className="h-10 rounded-lg bg-principal-9 px-4 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save track"}
          </button>
        </div>
      </form>

      {m ? <MentorshipLessonsPanel moduleId={m.id} /> : null}
    </div>
  );
}
