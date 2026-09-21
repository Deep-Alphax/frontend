"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import {
  createMaterial,
  deleteMaterial,
  type AdminMaterial,
  type MentorshipMaterialKind,
} from "@/lib/api/mentorship";
import { formatBytes } from "@/lib/mentorship/video";
import { getApiErrorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";

/*
 * Anexos de UMA aula, dentro do editor dela.
 *
 * Só aparece para aula JÁ SALVA: material pendura em `lessonId`, que não existe
 * antes do primeiro POST. Enquanto a aula é rascunho na tela, o painel explica
 * isso em vez de oferecer um formulário que falharia.
 *
 * Não há upload: o campo é a URL de um arquivo já hospedado (ver o model
 * `MentorshipMaterial`). O tamanho é digitado porque medir exigiria um HEAD num
 * host de terceiro a cada leitura da tela.
 */
const KINDS: MentorshipMaterialKind[] = [
  "PDF",
  "XLS",
  "DOC",
  "JSON",
  "ZIP",
  "LINK",
];

/** Aceita "2.4" (MB) do admin e devolve bytes. Vazio = desconhecido (0). */
function parseSizeMb(input: string): number | null {
  const raw = input.trim().replace(",", ".");
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1024 * 1024);
}

export function MaterialsEditor({
  lessonId,
  materials,
  onChanged,
}: {
  /** `null` enquanto a aula ainda não foi criada. */
  lessonId: string | null;
  materials: AdminMaterial[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<MentorshipMaterialKind>("PDF");
  const [sizeMb, setSizeMb] = useState("");

  const sizeBytes = parseSizeMb(sizeMb);
  const sizeInvalid = sizeBytes === null;
  const canAdd =
    Boolean(lessonId) &&
    title.trim() !== "" &&
    url.trim() !== "" &&
    !sizeInvalid;

  const reset = () => {
    setTitle("");
    setUrl("");
    setKind("PDF");
    setSizeMb("");
  };

  const addMut = useMutation({
    mutationFn: () =>
      createMaterial(lessonId as string, {
        title: title.trim(),
        url: url.trim(),
        kind,
        sizeBytes: sizeBytes ?? 0,
      }),
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

  return (
    <section className="flex flex-col gap-3 border-t border-gray-6 pt-4">
      <h4 className="text-sm font-semibold text-gray-12">
        Materials{" "}
        <span className="font-normal text-gray-11">({materials.length})</span>
      </h4>

      {!lessonId ? (
        <p className="text-xs text-gray-11">
          Save the lesson first — materials attach to an existing lesson.
        </p>
      ) : (
        <>
          {materials.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {materials.map((m) => {
                const size = formatBytes(m.sizeBytes);
                return (
                  <li
                    key={m.id}
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
                      onClick={() => removeMut.mutate(m.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-gray-6 text-gray-11 transition-colors hover:text-vermelho-11 disabled:opacity-50"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-xs text-gray-11">No materials yet.</p>
          )}

          {/* Campos soltos, não um <form>: este bloco vive DENTRO do form da
              aula, e form aninhado é HTML inválido — o Enter submeteria a aula. */}
          <div className="flex flex-col gap-2 rounded-lg border border-gray-6 bg-gray-1 p-3">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (e.g. RPC guide.pdf)"
                className="min-w-0 flex-1 rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8"
              />
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as MentorshipMaterialKind)
                }
                aria-label="Type"
                className="shrink-0 rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8"
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… (file URL)"
              className="w-full rounded-md border border-gray-6 bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none focus:border-gray-8"
            />

            <div className="flex items-center gap-2">
              <input
                value={sizeMb}
                onChange={(e) => setSizeMb(e.target.value)}
                placeholder="Size in MB (optional)"
                aria-label="Size in MB"
                className={cn(
                  "min-w-0 flex-1 rounded-md border bg-gray-2 px-2 py-1.5 text-sm text-gray-12 outline-none",
                  sizeInvalid
                    ? "border-vermelho-11"
                    : "border-gray-6 focus:border-gray-8",
                )}
              />
              <button
                type="button"
                disabled={!canAdd || addMut.isPending}
                onClick={() => addMut.mutate()}
                className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-gray-6 px-3 text-xs font-semibold text-gray-12 transition-colors hover:bg-gray-3 disabled:opacity-50"
              >
                <Plus className="size-3.5" strokeWidth={2.5} />
                Add
              </button>
            </div>

            {sizeInvalid ? (
              <p className="text-xs text-vermelho-11">
                Size must be a number in MB.
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}
