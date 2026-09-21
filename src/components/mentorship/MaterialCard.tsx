import { DownloadIcon } from "@/components/mentorship/icons";
import { TEXT_TRIM } from "@/components/plans/textTrim";
import type {
  MentorshipMaterial,
  MentorshipMaterialKind,
} from "@/lib/api/mentorship";
import { formatBytes } from "@/lib/mentorship/video";
import { cn } from "@/lib/cn";

/*
 * Card de material da aula (Figma 1039:25820).
 *
 * Mapa LITERAL de classes por tipo — mesma razão do acento das trilhas: o
 * Tailwind varre o código por strings estáticas, então `bg-${kind}` não geraria
 * CSS. O enum do banco existe justamente para que todo valor possível tenha
 * uma cor aqui.
 */
const KIND_BG: Record<MentorshipMaterialKind, string> = {
  PDF: "bg-vermelho-10",
  XLS: "bg-green-11",
  DOC: "bg-secundaria-10",
  JSON: "bg-azul-11",
  ZIP: "bg-laranja-10",
  LINK: "bg-violeta-10",
};

export function MaterialCard({ material }: { material: MentorshipMaterial }) {
  const size = formatBytes(material.sizeBytes);

  return (
    <a
      href={material.url}
      target="_blank"
      // `noopener` impede a página aberta de mexer nesta por `window.opener`;
      // `noreferrer` não vaza a URL da aula para o host do arquivo.
      rel="noopener noreferrer"
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-xl border border-gray-6 bg-gray-2 p-3",
        "outline-none transition-colors hover:border-gray-8 focus-visible:ring-2 focus-visible:ring-secundaria-11/60",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            "font-display text-[10px] font-bold text-gray-3",
            KIND_BG[material.kind] ?? KIND_BG.LINK,
          )}
        >
          {material.kind}
        </span>

        <span className="flex min-w-0 flex-col gap-3">
          <span
            className={cn(
              "truncate text-base font-semibold leading-[1.1] text-gray-12",
              TEXT_TRIM,
            )}
          >
            {material.title}
          </span>
          {/* Sem tamanho conhecido, a linha inteira some — não "0 B". */}
          {size ? (
            <span
              className={cn("text-sm leading-[1.3] text-gray-11", TEXT_TRIM)}
            >
              {size}
            </span>
          ) : null}
        </span>
      </span>

      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-gray-6 bg-gray-3 transition-colors group-hover:border-gray-8"
      >
        <DownloadIcon className="size-3.5 text-gray-11" />
      </span>
    </a>
  );
}
