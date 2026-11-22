"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ChevronRight, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";

import {
  AdminGate,
  DragHandle,
  Field,
  IconButton,
  inputCls,
  primaryBtnCls,
  secondaryBtnCls,
  slugify,
  slugifyLoose,
  smallBtnCls,
  StatusBadge,
  textareaCls,
  VisibilityBadge,
} from "@/components/admin/MentorshipAdminUi";
import { MentorshipStats } from "@/components/admin/MentorshipStats";
import {
  useDragReorder,
  type DragHandleProps,
  type DragItemProps,
} from "@/components/admin/useDragReorder";
import { Modal } from "@/components/walletReader/Modal";
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
  createCategory,
  createModule,
  deleteCategory,
  listAdminCategories,
  MENTORSHIP_OVERVIEW_KEY,
  reorderCategories,
  reorderModules,
  updateCategory,
  type AdminCategory,
  type AdminModuleSummary,
  type CategoryPayload,
} from "@/lib/api/mentorship";
import { cn } from "@/lib/cn";

/** Rota da página de um módulo no admin. */
export const adminModuleHref = (id: string) =>
  `/admin/mentorship/modules/${id}`;

/*
 * Admin da Mentoria — a ÁRVORE (Categoria → Módulos).
 *
 * Esta tela só organiza: cria e ordena categorias, cria e ordena módulos.
 * Editar um módulo e as aulas dele acontece na PÁGINA do módulo
 * (`/admin/mentorship/modules/[id]`), não em modal: lá cabe a lista de aulas
 * inteira, o painel da aula e o caminho de volta (breadcrumb).
 */
export function MentorshipAdmin() {
  return (
    <AdminGate>
      <MentorshipTree />
    </AdminGate>
  );
}

function MentorshipTree() {
  const qc = useQueryClient();
  // Abas em estado local: o admin entra por "Content" quase sempre, e um
  // parâmetro de URL para isto não paga a complexidade.
  const [tab, setTab] = useState<"content" | "usage">("content");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(
    null,
  );
  /** Categoria em que o módulo novo vai nascer; `null` = modal fechado. */
  const [newModuleIn, setNewModuleIn] = useState<string | null>(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ADMIN_CATEGORIES_KEY,
    queryFn: listAdminCategories,
  });

  const moduleCount = categories.reduce((n, c) => n + c.modules.length, 0);

  const afterWrite = () => {
    qc.invalidateQueries({ queryKey: ADMIN_CATEGORIES_KEY });
    qc.invalidateQueries({ queryKey: MENTORSHIP_OVERVIEW_KEY });
  };
  const fail = (fallback: string) => (e: unknown) =>
    toast.error(getAdminErrorMessage(e, fallback));

  const createCategoryMut = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      setCreatingCategory(false);
      afterWrite();
      toast.success("Category created.");
    },
    onError: fail("Could not create the category."),
  });

  const updateCategoryMut = useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<CategoryPayload>;
    }) => updateCategory(id, patch),
    onSuccess: () => {
      setEditingCategory(null);
      afterWrite();
      toast.success("Category saved.");
    },
    onError: fail("Could not save the category."),
  });

  const deleteCategoryMut = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      afterWrite();
      toast.success("Category deleted.");
    },
    onError: fail("Could not delete the category."),
  });

  const reorderCategoriesMut = useMutation({
    mutationFn: reorderCategories,
    onSuccess: afterWrite,
    onError: fail("Could not reorder."),
  });
  // `mutateAsync`: se falhar, o hook desfaz a ordem otimista sozinho.
  const categoryOrder = useDragReorder(categories, (ids) =>
    reorderCategoriesMut.mutateAsync(ids),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-12">Mentorship</h1>
        <p className="text-sm text-gray-11">
          Content is organized as{" "}
          <b className="text-gray-12">Category → Module → Lessons</b>. Each
          category is a section on{" "}
          <b className="text-gray-12">/mentorship</b>; open a module to manage
          its lessons. Drafts stay visible here and nowhere else.
        </p>
      </header>

      <div className="flex items-center gap-1 border-b border-gray-6">
        {(["content", "usage"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition-colors",
              tab === t
                ? "border-principal-9 text-gray-12"
                : "border-transparent text-gray-11 hover:text-gray-12",
            )}
          >
            {t === "content" ? "Content" : "Usage"}
          </button>
        ))}
      </div>

      {tab === "usage" ? <MentorshipStats /> : null}

      {tab === "content" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-gray-11">
              {categories.length}{" "}
              {categories.length === 1 ? "category" : "categories"} ·{" "}
              {moduleCount} {moduleCount === 1 ? "module" : "modules"}
            </span>
            <button
              type="button"
              onClick={() => setCreatingCategory(true)}
              className={primaryBtnCls}
            >
              <FolderPlus className="size-4" strokeWidth={2.25} />
              New category
            </button>
          </div>

          {isLoading ? (
            <SkeletonGroup className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl bg-gray-2" />
              ))}
            </SkeletonGroup>
          ) : null}

          {!isLoading && categories.length === 0 ? (
            <EmptyTree onCreate={() => setCreatingCategory(true)} />
          ) : null}

          <div className="flex flex-col gap-4">
            {categoryOrder.ordered.map((c) => (
              <CategoryCard
                key={c.id}
                category={c}
                dragItemProps={categoryOrder.itemProps(c.id)}
                dragHandleProps={categoryOrder.handleProps(c.id)}
                dragging={categoryOrder.draggingId === c.id}
                reordering={reorderCategoriesMut.isPending}
                onAddModule={() => setNewModuleIn(c.id)}
                onEdit={() => setEditingCategory(c)}
                deleting={deleteCategoryMut.isPending}
                onDelete={() => {
                  // O backend recusa (409) — avisar antes poupa a ida e diz o
                  // que fazer em vez de só "não deu".
                  if (c.modules.length > 0) {
                    toast.error(
                      `"${c.title}" still has ${c.modules.length} module(s). Move or delete them first.`,
                    );
                    return;
                  }
                  if (window.confirm(`Delete the category "${c.title}"?`)) {
                    deleteCategoryMut.mutate(c.id);
                  }
                }}
                onReordered={afterWrite}
              />
            ))}
          </div>
        </>
      ) : null}

      <CategoryEditor
        open={creatingCategory}
        category={null}
        saving={createCategoryMut.isPending}
        onClose={() => setCreatingCategory(false)}
        onSubmit={(payload) => createCategoryMut.mutate(payload)}
      />
      <CategoryEditor
        open={editingCategory !== null}
        category={editingCategory}
        saving={updateCategoryMut.isPending}
        onClose={() => setEditingCategory(null)}
        onSubmit={(patch) =>
          editingCategory &&
          updateCategoryMut.mutate({ id: editingCategory.id, patch })
        }
      />
      <NewModuleModal
        categoryId={newModuleIn}
        categories={categories}
        onClose={() => setNewModuleIn(null)}
        onCreated={afterWrite}
      />
    </div>
  );
}

/** Estado vazio que ENSINA a estrutura, em vez de só dizer "nada aqui". */
function EmptyTree({ onCreate }: { onCreate: () => void }) {
  const steps = [
    ["Create a category", "A section on the page, e.g. “Fundamentals”."],
    ["Add modules to it", "Each module is a card with its own cover."],
    ["Add lessons to each module", "A YouTube or Vimeo link per lesson."],
  ] as const;
  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed border-gray-6 p-8 text-center">
      <ol className="grid w-full max-w-2xl gap-3 text-left sm:grid-cols-3">
        {steps.map(([title, text], i) => (
          <li
            key={title}
            className="flex flex-col gap-1 rounded-lg bg-gray-2 p-3"
          >
            <span className="text-xs font-semibold text-principal-11">
              Step {i + 1}
            </span>
            <span className="text-sm font-semibold text-gray-12">{title}</span>
            <span className="text-xs text-gray-11">{text}</span>
          </li>
        ))}
      </ol>
      <button type="button" onClick={onCreate} className={primaryBtnCls}>
        <FolderPlus className="size-4" strokeWidth={2.25} />
        Create the first category
      </button>
    </div>
  );
}

function CategoryCard({
  category: c,
  dragItemProps,
  dragHandleProps,
  dragging,
  reordering,
  deleting,
  onAddModule,
  onEdit,
  onDelete,
  onReordered,
}: {
  category: AdminCategory;
  dragItemProps: DragItemProps;
  dragHandleProps: DragHandleProps;
  dragging: boolean;
  reordering: boolean;
  deleting: boolean;
  onAddModule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onReordered: () => void;
}) {
  const reorderModulesMut = useMutation({
    mutationFn: (ids: string[]) => reorderModules(c.id, ids),
    onSuccess: onReordered,
    onError: (e) => toast.error(getAdminErrorMessage(e, "Could not reorder.")),
  });
  const moduleOrder = useDragReorder(c.modules, (ids) =>
    reorderModulesMut.mutateAsync(ids),
  );

  return (
    <section
      aria-label={`Category ${c.title}`}
      {...dragItemProps}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-gray-6 bg-gray-1 p-3 transition-opacity",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2">
        <DragHandle
          label={`category ${c.title}`}
          disabled={reordering}
          {...dragHandleProps}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold text-gray-12">
              {c.title}
            </h2>
            {!c.published ? (
              <StatusBadge title="Users see none of its modules.">
                Draft
              </StatusBadge>
            ) : null}
          </div>
          <span className="truncate text-xs text-gray-11">
            {c.modules.length} {c.modules.length === 1 ? "module" : "modules"}
            {c.description ? ` · ${c.description}` : ""}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={onAddModule} className={smallBtnCls}>
            <Plus className="size-3.5" strokeWidth={2.5} />
            Module
          </button>
          <IconButton label={`Edit category ${c.title}`} onClick={onEdit}>
            <Pencil className="size-4" />
          </IconButton>
          <IconButton
            label={`Delete category ${c.title}`}
            danger
            disabled={deleting}
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      {c.modules.length === 0 ? (
        <button
          type="button"
          onClick={onAddModule}
          className="rounded-lg border border-dashed border-gray-6 p-4 text-center text-xs text-gray-11 transition-colors hover:border-gray-8 hover:text-gray-12"
        >
          No modules in this category yet. <b>Add the first module</b>
        </button>
      ) : (
        <ul className="flex flex-col gap-2">
          {moduleOrder.ordered.map((m) => (
            <ModuleRowItem
              key={m.id}
              module={m}
              categoryPublished={c.published}
              itemProps={moduleOrder.itemProps(m.id)}
              handleProps={moduleOrder.handleProps(m.id)}
              dragging={moduleOrder.draggingId === m.id}
              listDragging={moduleOrder.draggingId !== null}
              reordering={reorderModulesMut.isPending}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ModuleRowItem({
  module: m,
  categoryPublished,
  itemProps,
  handleProps,
  dragging,
  listDragging,
  reordering,
}: {
  module: AdminModuleSummary;
  categoryPublished: boolean;
  /** Algum módulo DESTA categoria está sendo arrastado. */
  listDragging: boolean;
  itemProps: DragItemProps;
  handleProps: DragHandleProps;
  dragging: boolean;
  reordering: boolean;
}) {
  return (
    <li
      {...itemProps}
      // Arrastar um módulo não pode "vazar" para a categoria (que também é
      // arrastável): sem isto o dragstart sobe e a seção inteira começa a mover.
      onDragStart={(e) => {
        e.stopPropagation();
        itemProps.onDragStart(e);
      }}
      onDragOver={(e) => {
        // Só "segura" o evento quando o arrasto é de um MÓDULO desta lista;
        // arrastando uma categoria por cima, ele tem que chegar à seção.
        if (!listDragging) return;
        e.stopPropagation();
        itemProps.onDragOver(e);
      }}
      onDragEnd={(e) => {
        e.stopPropagation();
        itemProps.onDragEnd(e);
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-gray-6 bg-gray-2 p-2 transition-opacity",
        dragging && "opacity-50",
      )}
    >
      <DragHandle label={m.title} disabled={reordering} {...handleProps} />
      <Link
        href={adminModuleHref(m.id)}
        draggable={false}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 outline-none focus-visible:ring-2 focus-visible:ring-secundaria-11/40"
      >
        <div className="size-12 shrink-0 overflow-hidden rounded-md bg-gray-3">
          {m.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.coverUrl}
              alt=""
              draggable={false}
              className="size-full object-cover"
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-gray-12 group-hover:underline">
              {m.title}
            </span>
            {m.label ? (
              <span className="shrink-0 text-xs text-gray-11">{m.label}</span>
            ) : null}
            <VisibilityBadge
              modulePublished={m.published}
              categoryPublished={categoryPublished}
            />
            {m.lessonCount === 0 ? (
              <StatusBadge tone="warning">No lessons</StatusBadge>
            ) : null}
          </div>
          <span className="truncate text-xs text-gray-11">
            /{m.slug} · {m.lessonCount}{" "}
            {m.lessonCount === 1 ? "lesson" : "lessons"}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-gray-11 group-hover:text-gray-12">
          Manage lessons
          <ChevronRight className="size-4" />
        </span>
      </Link>
    </li>
  );
}

// ── Categoria (modal pequeno: são três campos) ────────────────────────────────

function CategoryEditor({
  open,
  category: c,
  saving,
  onClose,
  onSubmit,
}: {
  open: boolean;
  category: AdminCategory | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CategoryPayload) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={c ? `Edit category — ${c.title}` : "New category"}
      className="max-w-lg"
    >
      <CategoryForm
        key={c?.id ?? "new"}
        category={c}
        saving={saving}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}

function CategoryForm({
  category: c,
  saving,
  onClose,
  onSubmit,
}: {
  category: AdminCategory | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (payload: CategoryPayload) => void;
}) {
  const [draft, setDraft] = useState<CategoryPayload>(() => ({
    title: c?.title ?? "",
    description: c?.description ?? "",
    published: c?.published ?? true,
  }));
  const canSave = draft.title.trim().length > 0;

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) {
          onSubmit({
            ...draft,
            title: draft.title.trim(),
            description: draft.description.trim(),
          });
        }
      }}
    >
      <Field label="Title" hint="Section title on /mentorship.">
        <input
          className={inputCls}
          value={draft.title}
          onChange={(e) => setDraft((p) => ({ ...p, title: e.target.value }))}
          placeholder="Fundamentals"
          autoFocus
        />
      </Field>

      <Field label="Description" hint="Optional. One line under the title.">
        <textarea
          className={textareaCls}
          value={draft.description}
          onChange={(e) =>
            setDraft((p) => ({ ...p, description: e.target.value }))
          }
          placeholder="Start here if you are new to on-chain trading."
        />
      </Field>

      <label className="flex items-start gap-2 text-sm text-gray-12">
        <input
          type="checkbox"
          checked={draft.published}
          onChange={(e) =>
            setDraft((p) => ({ ...p, published: e.target.checked }))
          }
          className="mt-0.5 size-4 accent-principal-9"
        />
        <span>
          Published
          <span className="block text-xs text-gray-11">
            When off, every module in it is hidden from users.
          </span>
        </span>
      </label>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className={secondaryBtnCls}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave || saving}
          className={primaryBtnCls}
        >
          {saving ? "Saving…" : "Save category"}
        </button>
      </div>
    </form>
  );
}

// ── Módulo novo: só o essencial, depois vai para a página dele ───────────────

function NewModuleModal({
  categoryId,
  categories,
  onClose,
  onCreated,
}: {
  categoryId: string | null;
  categories: AdminCategory[];
  onClose: () => void;
  onCreated: () => void;
}) {
  return (
    <Modal
      open={categoryId !== null}
      onClose={onClose}
      title="New module"
      className="max-w-lg"
    >
      {categoryId !== null ? (
        <NewModuleForm
          key={categoryId}
          defaultCategoryId={categoryId}
          categories={categories}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </Modal>
  );
}

function NewModuleForm({
  defaultCategoryId,
  categories,
  onClose,
  onCreated,
}: {
  defaultCategoryId: string;
  categories: AdminCategory[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(defaultCategoryId);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  // O slug segue o título só até alguém digitá-lo à mão.
  const [slugTouched, setSlugTouched] = useState(false);

  const createMut = useMutation({
    mutationFn: () =>
      createModule({
        categoryId,
        title: title.trim(),
        slug: slugify(slug),
        subtitle: "",
        label: "",
        coverUrl: "",
        accent: "PRINCIPAL",
        // Nasce RASCUNHO: um módulo sem aulas publicado viraria um card vazio
        // na tela de todo usuário até alguém terminar o cadastro.
        published: false,
      }),
    onSuccess: (created) => {
      onCreated();
      toast.success("Module created. Now add its lessons.");
      onClose();
      router.push(adminModuleHref(created.id));
    },
    onError: (e) =>
      toast.error(getAdminErrorMessage(e, "Could not create the module.")),
  });

  const canSave =
    title.trim().length > 0 && slugify(slug).length > 0 && categoryId !== "";

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave && !createMut.isPending) createMut.mutate();
      }}
    >
      <Field label="Category">
        <Select value={categoryId} onValueChange={setCategoryId}>
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
          value={title}
          autoFocus
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="On-chain fundamentals"
        />
      </Field>

      <Field label="Slug" hint={`URL: /mentorship/${slugify(slug) || "…"}`}>
        <input
          className={inputCls}
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugifyLoose(e.target.value));
          }}
          onBlur={(e) => setSlug(slugify(e.target.value))}
          placeholder="on-chain-fundamentals"
        />
      </Field>

      <p className="rounded-lg bg-gray-2 p-3 text-xs text-gray-11">
        The module starts as a <b className="text-gray-12">draft</b>. You will
        add the cover and lessons on the next screen, then publish it.
      </p>

      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={secondaryBtnCls}>
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSave || createMut.isPending}
          className={primaryBtnCls}
        >
          {createMut.isPending ? "Creating…" : "Create and add lessons"}
        </button>
      </div>
    </form>
  );
}
