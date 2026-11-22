"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { FileDropField } from "@/components/admin/FileDropField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select";
import {
  createMaterial,
  deleteMaterial,
  type AdminMaterial,
  type MaterialPayload,
  type MentorshipMaterialKind,
} from "@/lib/api/mentorship";
import { formatBytes } from "@/lib/mentorship/video";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/*
 * Anexos de UMA aula, dentro do painel dela.
 *
 * Dois modos:
 * - aula JÁ SALVA (`lessonId`): adicionar/remover vai direto à API;
 * - aula NOVA (`lessonId = null`): os anexos ficam numa fila local (`pending`)
 *   e o painel da aula os envia logo depois de criar a aula. Antes o admin
 *   tinha de salvar, reabrir e só então anexar.
 *
 * Não há upload: o campo é a URL de um arquivo já hospedado (ver o model
 * `MentorshipMaterial`). O tamanho é opcional e digitado, porque medir exigiria
 * um HEAD num host de terceiro.
 */
const KINDS: MentorshipMaterialKind[] = [
  "PDF",
  "XLS",
  "DOC",
  "JSON",
  "ZIP",
  "LINK",
];

const EXT_KIND: Record<string, MentorshipMaterialKind> = {
  pdf: "PDF",
  xls: "XLS",
  xlsx: "XLS",
  csv: "XLS",
  doc: "DOC",
  docx: "DOC",
  txt: "DOC",
  md: "DOC",
  json: "JSON",
  zip: "ZIP",
  rar: "ZIP",
  "7z": "ZIP",
};

/** Tipo pela extensão do link; sem extensão conhecida, é um LINK. */
export function guessMaterialKind(url: string): MentorshipMaterialKind {
  let path = url.trim();
  try {
    path = new URL(path).pathname;
  } catch {
    // Caminho relativo ("/files/x.pdf") ou texto incompleto: usa como veio.
  }
  const ext = path.split(/[?#]/)[0].split(".").pop()?.toLowerCase() ?? "";
  return EXT_KIND[ext] ?? "LINK";
}

/** Último segmento do link, sem extensão — sugestão de título. */
function titleFromUrl(url: string): string {
  try {
    const last = new URL(url.trim()).pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : "";
  } catch {
    return "";
  }
}

/** Aceita "2.4" (MB) do admin e devolve bytes. Vazio = desconhecido (0). */
function parseSizeMb(input: string): number | null {
  const raw = input.trim().replace(",", ".");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1024 * 1024);
}

const smallInputCls =
  "min-w-0 rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none placeholder:text-gray-11 focus:border-gray-8";

interface Row {
  key: string;
  title: string;
  url: string;
  kind: MentorshipMaterialKind;
  sizeBytes: number;
}

export function MaterialsEditor({
  lessonId,
  materials,
  onChanged,
  pending = [],
  onPendingChange,
}: {
  /** `null` enquanto a aula ainda não foi criada (modo fila). */
  lessonId: string | null;
  materials: AdminMaterial[];
  onChanged: () => void;
  /** Fila de anexos da aula nova — enviada pelo painel depois do POST. */
  pending?: MaterialPayload[];
  onPendingChange?: (next: MaterialPayload[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<MentorshipMaterialKind>("LINK");
  // Depois que o admin escolhe o tipo à mão, o link para de sobrescrevê-lo.
  const [kindTouched, setKindTouched] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [sizeMb, setSizeMb] = useState("");

  const queued = lessonId === null;
  const sizeBytes = parseSizeMb(sizeMb);
  const sizeInvalid = sizeBytes === null;
  const canAdd = url.trim() !== "" && title.trim() !== "" && !sizeInvalid;

  const reset = () => {
    setTitle("");
    setUrl("");
    setKind("LINK");
    setKindTouched(false);
    setTitleTouched(false);
    setSizeMb("");
  };

  const payload = (): MaterialPayload => ({
    title: title.trim(),
    url: url.trim(),
    kind,
    sizeBytes: sizeBytes ?? 0,
  });

  const addMut = useMutation({
    mutationFn: () => createMaterial(lessonId as string, payload()),
    onSuccess: () => {
      reset();
      onChanged();
      toast.success("Material added.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not add the material.")),
  });

  const removeMut = useMutation({
    mutationFn: deleteMaterial,
    onSuccess: () => {
      onChanged();
      toast.success("Material removed.");
    },
    onError: (e) =>
      toast.error(getApiErrorMessage(e, "Could not remove the material.")),
  });

  const add = () => {
    if (!canAdd) return;
    if (queued) {
      onPendingChange?.([...pending, payload()]);
      reset();
      return;
    }
    addMut.mutate();
  };

  const rows: Row[] = queued
    ? pending.map((p, i) => ({
        key: `pending-${i}`,
        title: p.title,
        url: p.url,
        kind: p.kind,
        sizeBytes: p.sizeBytes ?? 0,
      }))
    : materials.map((m) => ({ ...m, key: m.id }));

  return (
    <section className="flex flex-col gap-3 border-t border-gray-6 pt-4">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-12">
          Materials{" "}
          <span className="font-normal text-gray-11">({rows.length})</span>
        </h4>
        <span className="text-xs text-gray-11">
          PDFs, sheets or links shown under the video.
        </span>
      </div>

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rows.map((m, i) => {
            const size = formatBytes(m.sizeBytes);
            return (
              <li
                key={m.key}
                className="flex items-center gap-2 rounded-lg border border-gray-6 bg-gray-1 p-2"
              >
                <span className="w-12 shrink-0 text-center text-[10px] font-bold text-gray-11">
                  {m.kind}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-gray-12">
                    {m.title}
                  </span>
                  <span className="truncate text-xs text-gray-11">
                    {size ? `${size} · ` : ""}
                    {m.url}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${m.title}`}
                  disabled={removeMut.isPending}
                  onClick={() =>
                    queued
                      ? onPendingChange?.(pending.filter((_, j) => j !== i))
                      : removeMut.mutate(m.key)
                  }
                  className="flex size-7 shrink-0 items-center justify-center rounded-md border border-gray-6 text-gray-11 transition-colors hover:text-vermelho-11 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* Campos soltos, não um <form>: este bloco vive DENTRO do form da
          aula, e form aninhado é HTML inválido — o Enter submeteria a aula. */}
      <div className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-1 p-3">
        <FileDropField
          kind="material"
          label="File"
          value={url}
          linkPlaceholder="https://… (file link)"
          onChange={(next) => {
            setUrl(next);
            if (!kindTouched) setKind(guessMaterialKind(next));
            // Título sugerido pelo nome do arquivo até o admin digitar o dele.
            if (!titleTouched) setTitle(titleFromUrl(next));
          }}
          onUploaded={(file) => {
            // Upload sabe o que o link não sabe: nome original e tamanho real.
            if (!titleTouched) setTitle(file.name);
            setSizeMb((file.sizeBytes / (1024 * 1024)).toFixed(2));
          }}
        />
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
            placeholder="Title shown to users"
            aria-label="Material title"
            className={cn(smallInputCls, "flex-1")}
          />
          <div className="w-24 shrink-0">
            <Select
              value={kind}
              onValueChange={(v) => {
                setKindTouched(true);
                setKind(v as MentorshipMaterialKind);
              }}
            >
              <SelectTrigger aria-label="Type" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={sizeMb}
            onChange={(e) => setSizeMb(e.target.value)}
            placeholder="Size in MB (optional)"
            aria-label="Size in MB"
            aria-invalid={sizeInvalid}
            className={cn(
              smallInputCls,
              "flex-1",
              sizeInvalid && "border-vermelho-11",
            )}
          />
          <button
            type="button"
            disabled={!canAdd || addMut.isPending}
            onClick={add}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-gray-6 px-3 text-xs font-semibold text-gray-12 transition-colors hover:bg-gray-3 disabled:opacity-50"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Add material
          </button>
        </div>
        {sizeInvalid ? (
          <p className="text-xs text-vermelho-11">
            Size must be a number in MB.
          </p>
        ) : queued && pending.length > 0 ? (
          <p className="text-xs text-gray-11">
            Saved together with the lesson.
          </p>
        ) : null}
      </div>
    </section>
  );
}
