/*
 * Ícones do Copy Trade com o path EXATO do export do Figma (1578:26210 e
 * 1577:23037). Inline com `currentColor` pelo mesmo motivo de
 * `icons/hugeicons.tsx`: o export fixa a cor no path e a cor aqui vem da
 * classe do pai. Cada um mantém o viewBox do asset — quem consome define o
 * tamanho (`size-3.5`, `size-5`…) igual ao slot do design.
 */

interface IconProps {
  className?: string;
}

function Svg({
  viewBox,
  className,
  children,
}: IconProps & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg viewBox={viewBox} fill="none" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** `interface/outline/copy` de 14 px (aba Wallet Copy) — traço 1,5 nesse tamanho. */
export function CopySmallIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path
        d="M4.66667 4.66667V3.5C4.66667 2.21134 5.71134 1.16667 7 1.16667L10.5 1.16667C11.7887 1.16667 12.8333 2.21134 12.8333 3.5V7C12.8333 8.28866 11.7887 9.33333 10.5 9.33333H9.33333M4.66667 4.66667H3.5C2.21134 4.66667 1.16667 5.71134 1.16667 7V10.5C1.16667 11.7887 2.21134 12.8333 3.5 12.8333H7C8.28866 12.8333 9.33333 11.7887 9.33333 10.5V9.33333M4.66667 4.66667H7C8.28866 4.66667 9.33333 5.71134 9.33333 7V9.33333"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** `interface/outline/plus` de 20 px (botão "Create copy"). */
export function PlusLargeIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" className={className}>
      <path d="M10 5V10M10 10V15M10 10H15M10 10L5 10" {...stroke} />
    </Svg>
  );
}

/** `interface/outline/copy` de 20 px (botão "Copy @kol"). */
export function CopyOutlineIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" className={className}>
      <path
        d="M6.66667 6.66667L6.66667 5C6.66667 3.15905 8.15905 1.66667 10 1.66667L15 1.66667C16.8409 1.66667 18.3333 3.15905 18.3333 5V10C18.3333 11.8409 16.8409 13.3333 15 13.3333H13.3333M6.66667 6.66667L5 6.66667C3.15905 6.66667 1.66667 8.15905 1.66667 10L1.66667 15C1.66667 16.8409 3.15905 18.3333 5 18.3333H10C11.8409 18.3333 13.3333 16.8409 13.3333 15V13.3333M6.66667 6.66667H10C11.8409 6.66667 13.3333 8.15905 13.3333 10V13.3333"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Símbolo da aba Dev Snipe (alvo com ponto central). */
export function DevSnipeIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <circle cx="7" cy="7" r="0.583333" fill="currentColor" />
      <path
        d="M9.91667 7C9.91667 8.61083 8.61083 9.91667 7 9.91667C5.38917 9.91667 4.08333 8.61083 4.08333 7C4.08333 5.38917 5.38917 4.08333 7 4.08333C8.61083 4.08333 9.91667 5.38917 9.91667 7ZM12.8333 7C12.8333 10.2217 10.2217 12.8333 7 12.8333C3.77834 12.8333 1.16667 10.2217 1.16667 7C1.16667 3.77834 3.77834 1.16667 7 1.16667C10.2217 1.16667 12.8333 3.77834 12.8333 7Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** `interface/outline/plus` de 14 px (FAQ e linha do tempo). */
export function PlusIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path d="M7 3.5V7M7 7V10.5M7 7L10.5 7M7 7L3.5 7" {...stroke} />
    </Svg>
  );
}

/** `interface/outline/minus`. */
export function MinusIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path d="M10.5 7H3.5" {...stroke} />
    </Svg>
  );
}

/** `interface/outline/search 01`. */
export function SearchIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" className={className}>
      <path
        d="M18.3333 18.3333L16.6667 16.6667M1.66667 9.58333C1.66667 5.21108 5.21108 1.66667 9.58333 1.66667C13.9556 1.66667 17.5 5.21108 17.5 9.58333C17.5 13.9556 13.9556 17.5 9.58333 17.5C5.21108 17.5 1.66667 13.9556 1.66667 9.58333Z"
        {...stroke}
      />
    </Svg>
  );
}

/** `interface/outline/remove` — fechar a 3ª coluna. */
export function RemoveIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 24 24" className={className}>
      <path
        d="M16.2427 7.75739L12.0001 12M12.0001 12L7.75739 16.2427M12.0001 12L16.2427 16.2426M12.0001 12L7.75739 7.75733"
        {...stroke}
      />
    </Svg>
  );
}

/** `communication/outline/chat 02` — call no grupo. */
export function ChatIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path
        d="M4.66667 5.83333H9.33333M4.66667 8.16667H7M6.41667 1.75H7.58333C10.4828 1.75 12.8333 4.10051 12.8333 7C12.8333 9.89949 10.4828 12.25 7.58333 12.25H3.5C2.21134 12.25 1.16667 11.2053 1.16667 9.91667V7C1.16667 4.10051 3.51717 1.75 6.41667 1.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ── Ícones de título de seção (caixa de 12 px no Figma) ──

/** "For you" — estrela. */
export function StarIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 11.4954 11.5074" className={className}>
      <path
        d="M4.76413 1.38571C5.16647 0.538099 6.32897 0.538097 6.73132 1.3857L7.42667 2.85059C7.58644 3.18717 7.89528 3.42047 8.25253 3.47444L9.80739 3.70935C10.7071 3.84527 11.0663 4.99477 10.4153 5.65454L9.29018 6.7948C9.03167 7.05679 8.9137 7.43427 8.97473 7.80421L9.24033 9.41427C9.39401 10.3459 8.45353 11.0563 7.64884 10.6165L6.25814 9.8563C5.93859 9.68164 5.55685 9.68164 5.23731 9.8563L3.8466 10.6165C3.04192 11.0563 2.10143 10.3459 2.25511 9.41428L2.52072 7.80421C2.58174 7.43427 2.46378 7.05679 2.20526 6.7948L1.08016 5.65454C0.429155 4.99477 0.788386 3.84527 1.68805 3.70935L3.24291 3.47444C3.60017 3.42047 3.90901 3.18717 4.06878 2.85059L4.76413 1.38571Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** "Trending today" — `chart arrow up`. */
export function ChartUpIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 10.75 10.75" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M0.75 0.375C0.75 0.167893 0.582107 0 0.375 0C0.167893 0 0 0.167893 0 0.375V8.375C0 9.68668 1.06332 10.75 2.375 10.75H10.375C10.5821 10.75 10.75 10.5821 10.75 10.375C10.75 10.1679 10.5821 10 10.375 10H2.375C1.47754 10 0.75 9.27246 0.75 8.375V0.375ZM7.75 3.875C7.75 3.66789 7.91789 3.5 8.125 3.5H8.875C9.35825 3.5 9.75 3.89175 9.75 4.375V5.125C9.75 5.33211 9.58211 5.5 9.375 5.5C9.16789 5.5 9 5.33211 9 5.125V4.78033L7.84727 5.93306C7.3103 6.47003 6.4397 6.47003 5.90273 5.93306L5.31694 5.34727C5.07286 5.10319 4.67714 5.10319 4.43306 5.34727L3.14017 6.64017C2.99372 6.78661 2.75628 6.78661 2.60983 6.64017C2.46339 6.49372 2.46339 6.25628 2.60983 6.10983L3.90273 4.81694C4.4397 4.27997 5.3103 4.27997 5.84727 4.81694L6.43306 5.40273C6.67714 5.64681 7.07286 5.64681 7.31694 5.40273L8.46967 4.25H8.125C7.91789 4.25 7.75 4.08211 7.75 3.875Z"
      />
    </Svg>
  );
}

/** "Highest hit rate" — alvo. */
export function TargetIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 11.5 11.5" className={className}>
      <path
        d="M8.25 5.75C8.25 7.13071 7.13071 8.25 5.75 8.25C4.36929 8.25 3.25 7.13071 3.25 5.75C3.25 4.36929 4.36929 3.25 5.75 3.25C7.13071 3.25 8.25 4.36929 8.25 5.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M10.75 5.75C10.75 8.51142 8.51142 10.75 5.75 10.75C2.98858 10.75 0.75 8.51142 0.75 5.75C0.75 2.98858 2.98858 0.75 5.75 0.75C8.51142 0.75 10.75 2.98858 10.75 5.75Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** "New in Deep Ranking" — mais pequeno. */
export function PlusSmallIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 7.5 7.5" className={className}>
      <path d="M3.75 0.75V6.75M6.75 3.75L0.75 3.75" {...stroke} />
    </Svg>
  );
}

/** "Common questions" — interrogação no círculo. */
export function HelpIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 12 12" className={className}>
      <path
        fill="currentColor"
        d="M6.84156 5.0404L7.47226 5.44624V5.44624L6.84156 5.0404ZM4.25 4.5C4.25 4.91421 4.58579 5.25 5 5.25C5.41421 5.25 5.75 4.91421 5.75 4.5H5H4.25ZM5.25 6.75C5.25 7.16421 5.58579 7.5 6 7.5C6.41421 7.5 6.75 7.16421 6.75 6.75H6H5.25ZM6.75 8C6.75 7.58579 6.41421 7.25 6 7.25C5.58579 7.25 5.25 7.58579 5.25 8H6H6.75ZM5.25 8.5C5.25 8.91421 5.58579 9.25 6 9.25C6.41421 9.25 6.75 8.91421 6.75 8.5H6H5.25ZM11 6H10.25C10.25 8.34721 8.34721 10.25 6 10.25V11V11.75C9.17564 11.75 11.75 9.17564 11.75 6H11ZM6 11V10.25C3.65279 10.25 1.75 8.34721 1.75 6H1H0.25C0.25 9.17564 2.82436 11.75 6 11.75V11ZM1 6H1.75C1.75 3.65279 3.65279 1.75 6 1.75V1V0.25C2.82436 0.25 0.25 2.82436 0.25 6H1ZM6 1V1.75C8.34721 1.75 10.25 3.65279 10.25 6H11H11.75C11.75 2.82436 9.17564 0.25 6 0.25V1ZM7 4.5H6.25C6.25 4.55089 6.23558 4.59612 6.21085 4.63455L6.84156 5.0404L7.47226 5.44624C7.64808 5.17301 7.75 4.84726 7.75 4.5H7ZM5 4.5H5.75C5.75 4.36193 5.86193 4.25 6 4.25V3.5V2.75C5.0335 2.75 4.25 3.5335 4.25 4.5H5ZM6 3.5V4.25C6.13807 4.25 6.25 4.36193 6.25 4.5H7H7.75C7.75 3.5335 6.9665 2.75 6 2.75V3.5ZM6 6.5H5.25V6.75H6H6.75V6.5H6ZM6.84156 5.0404L6.21085 4.63455C6.15963 4.71414 6.09194 4.80186 5.99966 4.91656C5.91522 5.0215 5.80266 5.158 5.70225 5.296C5.50674 5.56471 5.25 5.97688 5.25 6.5H6H6.75C6.75 6.47084 6.76462 6.38543 6.91516 6.17852C6.98779 6.0787 7.06694 5.98288 7.16831 5.8569C7.26183 5.74067 7.37405 5.59887 7.47226 5.44624L6.84156 5.0404ZM6 8H5.25V8.5H6H6.75V8H6Z"
      />
    </Svg>
  );
}

// ── Drawer "Configurar copy", alerta e rodapé (Figma 1618:30433 / 1577:23725) ──

/** `interface/outline/shield` — "Proteção Deep Alpha". */
export function ShieldIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" className={className}>
      <path
        d="M3.58508 3.29552L6.91696 1.81468C7.60647 1.50824 8.39353 1.50823 9.08304 1.81468L12.4017 3.28965C13.3722 3.72097 14.0092 4.69038 13.9412 5.7502C13.6804 9.81539 12.5181 11.6531 9.37642 13.7851C8.54731 14.3477 7.4536 14.3464 6.62387 13.7846C3.49179 11.6642 2.28642 9.85209 2.04667 5.73594C1.98534 4.68308 2.62133 3.72385 3.58508 3.29552ZM10 8C10 9.10457 9.10457 10 8 10C6.89543 10 6 9.10457 6 8C6 6.89543 6.89543 6 8 6C9.10457 6 10 6.89543 10 8Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** Funil — "Filtros do token". */
export function FilterIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" className={className}>
      <path
        d="M3.45411 1.33333H12.5459C13.7053 1.33333 14.3969 2.61037 13.7538 3.56376L9.93929 8.55163C9.62134 9.02296 9.45167 9.57675 9.45167 10.1432V12.5133C9.45167 12.7035 9.3752 12.886 9.23908 13.0205L7.78741 14.4551C7.33016 14.907 6.54833 14.587 6.54833 13.9479V10.1432C6.54833 9.57675 6.37866 9.02296 6.06071 8.55163L2.24625 3.56376C1.6031 2.61036 2.29467 1.33333 3.45411 1.33333Z"
        {...stroke}
      />
    </Svg>
  );
}

/** Raio — "Execução". */
export function BoltIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" className={className}>
      <path
        d="M9.33333 1.33333L3.33333 9H6.66667V14.6667L12.6667 7H9.33333V1.33333Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Seta do acordeão (aponta para baixo; gire 180° quando aberto). */
export function ChevronIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path d="M4.08333 5.83333L7 8.16667L9.91667 5.83333" {...stroke} strokeWidth={1.75} />
    </Svg>
  );
}

/** `interface/outline/warning` — alerta "parou por saldo". */
export function WarningIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 16 16" className={className}>
      <circle cx="8" cy="11.3333" r="0.666667" fill="currentColor" />
      <path
        d="M8 9.33333L8 4.66667M14.6667 8C14.6667 11.6819 11.6819 14.6667 8 14.6667C4.3181 14.6667 1.33333 11.6819 1.33333 8C1.33333 4.3181 4.3181 1.33333 8 1.33333C11.6819 1.33333 14.6667 4.3181 14.6667 8Z"
        {...stroke}
      />
    </Svg>
  );
}

/** `multimedia/outline/pause` — botão "Pausar". */
export function PauseIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 20 20" className={className}>
      <path
        d="M5 15.8333H6.66667C7.58714 15.8333 8.33333 15.0871 8.33333 14.1667V5.83333C8.33333 4.91286 7.58714 4.16667 6.66667 4.16667H5C4.07953 4.16667 3.33333 4.91286 3.33333 5.83333L3.33333 14.1667C3.33333 15.0871 4.07953 15.8333 5 15.8333ZM13.3333 15.8333H15C15.9205 15.8333 16.6667 15.0871 16.6667 14.1667V5.83333C16.6667 4.91286 15.9205 4.16667 15 4.16667L13.3333 4.16667C12.4129 4.16667 11.6667 4.91286 11.6667 5.83333L11.6667 14.1667C11.6667 15.0871 12.4129 15.8333 13.3333 15.8333Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

/** `interface/outline/trash` — remover meta. */
export function TrashIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 14 14" className={className}>
      <path
        d="M2.91667 4.66667V10.5C2.91667 11.7887 3.96134 12.8333 5.25 12.8333H8.75C10.0387 12.8333 11.0833 11.7887 11.0833 10.5V4.66667M8.16667 6.41667V9.91667M5.83333 6.41667L5.83333 9.91667M9.33333 2.91667L8.51301 1.68618C8.29663 1.36162 7.93236 1.16667 7.54229 1.16667H6.45771C6.06764 1.16667 5.70337 1.36162 5.48699 1.68618L4.66667 2.91667M9.33333 2.91667H4.66667M9.33333 2.91667H12.25M4.66667 2.91667H1.75"
        {...stroke}
      />
    </Svg>
  );
}

/** Seta da paginação (`arrows/solid/arrow-right`, desenhada para cima — gire ±90°). */
export function ArrowUpIcon({ className }: IconProps) {
  return (
    <Svg viewBox="0 0 5.54167 7.875" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M2.46147 0.128141C2.63233 -0.0427136 2.90934 -0.0427136 3.08019 0.128141L5.41353 2.46147C5.58438 2.63233 5.58438 2.90934 5.41353 3.08019C5.24267 3.25105 4.96566 3.25105 4.79481 3.08019L3.20833 1.49372V7.4375C3.20833 7.67912 3.01246 7.875 2.77083 7.875C2.52921 7.875 2.33333 7.67912 2.33333 7.4375V1.49372L0.746859 3.08019C0.576005 3.25105 0.298995 3.25105 0.128141 3.08019C-0.0427136 2.90934 -0.0427136 2.63233 0.128141 2.46147L2.46147 0.128141Z"
      />
    </Svg>
  );
}
