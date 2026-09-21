/*
 * Ícones da mentoria, com o path EXATO exportado do Figma (HugeIcons).
 *
 * São inline em vez de <img src="...svg"> por um motivo só: o export do Figma
 * fixa `stroke="#212124"` / `fill="#2A7E3B"` (a variante clara do arquivo), e o
 * app é dark. Com `currentColor` a cor passa a vir da classe do pai.
 *
 * Os demais ícones da tela (chevrons dos controles) vêm do `lucide-react` já
 * usado no projeto — o glifo é o mesmo do arquivo de design.
 */

/** Play em contorno, 40×40 no Figma (dentro do anel de 64px do card Continue). */
export function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M28.2686 22.8941L14.9871 30.4835C12.7649 31.7534 10 30.1488 10 27.5894V12.4106C10 9.85119 12.7649 8.24663 14.9871 9.51646L28.2686 17.1059C30.508 18.3855 30.508 21.6145 28.2686 22.8941Z"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Check em círculo SÓLIDO (o check é recorte, não traço) — marca a aula
 * concluída sobre a thumbnail. O `drop-shadow` reproduz o brilho escuro que o
 * Figma aplica por filtro, necessário para o ícone não sumir numa arte clara.
 */
export function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 20C15.5228 20 20 15.5228 20 10C20 4.47715 15.5228 0 10 0C4.47715 0 0 4.47715 0 10C0 15.5228 4.47715 20 10 20ZM14.592 7.46049C14.8463 7.13351 14.7874 6.66233 14.4605 6.40802C14.1335 6.15372 13.6623 6.21262 13.408 6.5396L9.40098 11.6914C9.31194 11.806 9.14433 11.8209 9.03642 11.7238L6.50173 9.44258C6.19385 9.16549 5.71962 9.19041 5.44253 9.49828C5.16544 9.80616 5.19036 10.2804 5.49823 10.5575L8.03293 12.8387C8.78806 13.5183 9.96132 13.4143 10.585 12.6123L14.592 7.46049Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Seta de download do card de material (Figma 1039:25828).
 *
 * Path exato do export; só o `stroke` fixo (#C0C2CE, a cor da variante clara)
 * virou `currentColor` — senão o ícone não acompanha o hover nem o tema.
 */
export function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M7 8.75V1.75M9.91667 5.83333L7 8.75L4.08333 5.83333M12.25 8.75V11.0833C12.25 11.3928 12.1271 11.6895 11.9083 11.9083C11.6895 12.1271 11.3928 12.25 11.0833 12.25H2.91667C2.60725 12.25 2.3105 12.1271 2.09171 11.9083C1.87292 11.6895 1.75 11.3928 1.75 11.0833V8.75"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
