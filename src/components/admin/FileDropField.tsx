"use client";

import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImageUp, Link2, Upload, X } from "lucide-react";

import { inputCls } from "@/components/admin/MentorshipAdminUi";
import { getAdminErrorMessage } from "@/lib/api/client";
import {
  getUploadsConfig,
  UPLOADS_CONFIG_KEY,
  uploadMentorshipFile,
  type UploadedFile,
  type UploadKind,
} from "@/lib/api/mentorship";
import { cn } from "@/lib/cn";

/*
 * Campo de arquivo da mentoria: arrastar e soltar (ou escolher) envia ao
 * Cloudflare R2 e preenche a URL; colar um link continua valendo.
 *
 * - Upload desligado no backend (sem R2) → mostra só o campo de link, com aviso.
 * - Tipo e tamanho são checados aqui ANTES de pedir a URL (erro imediato), mas
 *   quem decide é o backend — e o R2 recusa o PUT fora do que foi assinado.
 * - Não usa o `Field` (que é um <label>): um label em volta de botões e de um
 *   input de arquivo faria qualquer clique na área abrir o seletor.
 */

const MB = 1024 * 1024;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function FileDropField({
  kind,
  label,
  hint,
  value,
  onChange,
  onUploaded,
  preview = kind === "cover",
  linkPlaceholder = "https://…",
}: {
  kind: UploadKind;
  label: string;
  hint?: string;
  /** URL atual (do upload ou colada). */
  value: string;
  onChange: (url: string) => void;
  /** Chamado depois de um upload bem-sucedido, com nome e tamanho do arquivo. */
  onUploaded?: (file: UploadedFile) => void;
  /** Miniatura da imagem atual (capas). */
  preview?: boolean;
  linkPlaceholder?: string;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const { data: config } = useQuery({
    queryKey: UPLOADS_CONFIG_KEY,
    queryFn: getUploadsConfig,
    // Muda só com deploy: não há por que reconsultar a cada tela.
    staleTime: 10 * 60_000,
  });
  const enabled = config?.enabled ?? false;
  const accept = config?.accept[kind] ?? [];
  const limit = config?.limits[kind] ?? 0;

  // Sair da tela no meio do envio cancela o PUT.
  useEffect(() => () => abortRef.current?.abort(), []);

  const upload = async (file: File) => {
    setError(null);
    if (accept.length && !accept.includes(extensionOf(file.name))) {
      setError(`This file type isn't allowed. Use: ${accept.join(", ")}.`);
      return;
    }
    if (limit && file.size > limit) {
      setError(`File too large. The limit is ${Math.round(limit / MB)} MB.`);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      const uploaded = await uploadMentorshipFile(
        file,
        kind,
        setProgress,
        controller.signal,
      );
      onChange(uploaded.url);
      onUploaded?.(uploaded);
    } catch (e) {
      if (!controller.signal.aborted) {
        setError(getAdminErrorMessage(e, "Upload failed. Try again."));
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && progress === null) void upload(file);
  };

  const uploading = progress !== null;
  const hasImage = preview && value.trim() !== "";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-11">
        {label}
      </span>

      {enabled ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          data-testid={`drop-${kind}`}
          className={cn(
            "flex items-center gap-3 rounded-lg border border-dashed p-3 transition-colors",
            over ? "border-principal-9 bg-principal-3/30" : "border-gray-6",
          )}
        >
          {hasImage ? (
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md border border-gray-6 bg-gray-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Current image" className="size-full object-cover" />
            </div>
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-gray-3 text-gray-11">
              {kind === "cover" ? (
                <ImageUp className="size-5" />
              ) : (
                <Upload className="size-5" />
              )}
            </span>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {uploading ? (
              <>
                <span className="text-sm text-gray-12">
                  Uploading… {Math.round((progress ?? 0) * 100)}%
                </span>
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={Math.round((progress ?? 0) * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-gray-4"
                >
                  <div
                    className="h-full bg-principal-9 transition-[width]"
                    style={{ width: `${Math.round((progress ?? 0) * 100)}%` }}
                  />
                </div>
              </>
            ) : (
              <>
                <span className="text-sm text-gray-12">
                  Drag a file here or{" "}
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="font-semibold text-principal-11 underline-offset-2 hover:underline"
                  >
                    {hasImage ? "replace it" : "browse"}
                  </button>
                </span>
                <span className="truncate text-xs text-gray-11">
                  {accept.join(", ").toUpperCase()}
                  {limit ? ` · up to ${Math.round(limit / MB)} MB` : ""}
                </span>
              </>
            )}
          </div>

          {uploading ? (
            <button
              type="button"
              aria-label="Cancel upload"
              onClick={() => abortRef.current?.abort()}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-11 hover:bg-gray-3 hover:text-gray-12"
            >
              <X className="size-4" />
            </button>
          ) : null}

          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-label={`Upload ${label.toLowerCase()}`}
            accept={accept.map((ext) => `.${ext}`).join(",")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Limpa para o mesmo arquivo poder ser escolhido de novo.
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Link2 className="size-4 shrink-0 text-gray-11" aria-hidden />
        <input
          id={inputId}
          className={inputCls}
          value={value}
          aria-label={`${label} link`}
          onChange={(e) => onChange(e.target.value)}
          placeholder={enabled ? `or paste a link: ${linkPlaceholder}` : linkPlaceholder}
        />
        {!enabled && hasImage ? (
          <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-gray-6 bg-gray-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Current image" className="size-full object-cover" />
          </div>
        ) : null}
      </div>

      {error ? (
        <span role="alert" className="text-xs text-vermelho-11">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-gray-11">{hint}</span>
      ) : null}
    </div>
  );
}
