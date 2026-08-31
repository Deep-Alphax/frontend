/**
 * Wallet Reader (KOL Index) — port do app standalone p/ o Deep Alpha (React + DS).
 * Tipos e constantes de domínio. O índice vem do backend em duas camadas — o
 * PRESET global (`KolPreset`, editável só por ADMIN em /admin/kols) e o OVERRIDE
 * da conta (`KolUserOverride`) —, mescladas em `useKolIndex`. O JSON em
 * `public/wallet-reader/` ficou só como semente histórica do backend.
 */

/** Carteira on-chain de um KOL. */
export interface WalletRef {
  name: string;
  address: string;
}

/** Perfil-base (estático, gerado do wallets.txt). */
export interface KolProfile {
  id: string;
  name: string;
  wallets: WalletRef[];
  squads: string[];
  seedRelevance: number;
}

/** Edições do usuário sobre um perfil (persistidas por id no localStorage). */
export interface KolOverride {
  name?: string;
  relevance?: number;
  types?: string[];
  fnfGroups?: string[];
  twitter?: string;
  notes?: string;
  avatar?: string | null;
  walletsAdded?: WalletRef[];
  walletsRemoved?: string[];
  dismissedSidewallets?: string[];
  deleted?: boolean;
  updatedAt?: number;
}

/** Grupo/FnF criado pelo usuário. */
export interface KolGroup {
  id: string;
  name: string;
}

/** Estado efetivo de um KOL (base + override aplicados). */
export interface KolState {
  id: string;
  name: string;
  wallets: WalletRef[];
  walletCount: number;
  squads: string[];
  seedRelevance: number;
  isCustom: boolean;
  relevance: number;
  types: string[];
  fnfGroups: string[];
  twitter: string;
  notes: string;
  avatar: string | null;
  dismissedSidewallets: string[];
}

/** Tipos de trader (etiquetas). `hue` mantém a cor original do app. */
export const KOL_TYPES = [
  { id: "trencher", label: "Trencher", hue: 340 },
  { id: "whale", label: "Whale", hue: 200 },
  { id: "alpha", label: "Alpha Caller", hue: 80 },
  { id: "sniper", label: "Sniper", hue: 20 },
  { id: "farmer", label: "Farmer", hue: 150 },
  { id: "insider", label: "Insider", hue: 260 },
  { id: "rugger", label: "Rugger", hue: 0 },
  { id: "degen", label: "Degen", hue: 300 },
  { id: "copytrader", label: "Copytrader", hue: 230 },
  { id: "dev", label: "Dev", hue: 45 },
  { id: "alphadev", label: "Alpha Dev", hue: 110 },
  { id: "influencer", label: "Influencer", hue: 180 },
] as const;

export const KOL_TYPE_MAP: Record<string, { id: string; label: string; hue: number }> =
  Object.fromEntries(KOL_TYPES.map((t) => [t.id, t]));

/**
 * Níveis ("Level") do KOL — 8 faixas de relevância, do Wood ao Super alpha
 * (node Figma 886:18067). Espelha `TIERS` em
 * `backend/src/app/wallet-reader/kol-index.service.ts`: os `id` e as faixas TÊM
 * que bater, senão o filtro por tier e as contagens da rail divergem.
 *
 * Cada nível carrega o SKIN COMPLETO do card (borda + fundo, anel do avatar,
 * barra, cantoneiras, pílula) e o emblema exportado do Figma. Classes LITERAIS:
 * o Tailwind v4 só emite o que é estático.
 */
export interface TierSpec {
  id: string;
  label: string;
  min: number;
  max: number;
  /** Emblema do nível (webp 256px, exportado do Figma). */
  emblem: string;
  /** Cor do texto (pílula/nº) — usada fora do card. */
  text: string;
  /** Fundo sutil da pílula. */
  chipBg: string;
  chipBorder: string;
  /** Cor da barra de relevância. */
  meter: string;
  /** Skin do card: borda + fundo em degradê (112,5°). */
  card: string;
  /** Anel do avatar (2px). */
  ring: string;
  /** Degradê da barra de 2px sob o perfil. */
  bar: string;
  /**
   * Cantoneiras decorativas: são um DEGRADÊ vertical (o topo do "L" é a cor
   * viva do nível; descendo pelo braço esquerdo ela se apaga). Guarda o par
   * `from-*`/`to-*`; a máscara que recorta o L está no KolCard.
   */
  corner: string;
  /** Pílula "Level": borda + degradê do fundo. */
  pill: string;
  /** Texto da pílula (o topo do ranking usa degradê no próprio texto). */
  pillText: string;
}

export const KOL_TIERS: TierSpec[] = [
  {
    id: "wood", label: "Wood", min: 0, max: 12,
    emblem: "/wallet-reader/tiers/wood.webp",
    text: "text-bronze-11", chipBg: "bg-bronze-3", chipBorder: "border-bronze-6", meter: "bg-bronze-9",
    card: "border-bronze-4 bg-[linear-gradient(112.5deg,var(--color-bronze-3)_0%,var(--color-bronze-1)_100%)]",
    ring: "border-bronze-6", bar: "from-bronze-6 to-bronze-9", corner: "from-laranja-6 to-laranja-6/55",
    pill: "border-bronze-8 from-bronze-3 to-bronze-2", pillText: "text-bronze-12",
  },
  {
    id: "bronze", label: "Bronze", min: 13, max: 25,
    emblem: "/wallet-reader/tiers/bronze.webp",
    text: "text-laranja-11", chipBg: "bg-laranja-3", chipBorder: "border-laranja-6", meter: "bg-laranja-9",
    card: "border-laranja-6 bg-[linear-gradient(112.5deg,var(--color-laranja-3)_0%,var(--color-laranja-1)_100%)]",
    ring: "border-laranja-6", bar: "from-laranja-6 to-laranja-9", corner: "from-laranja-9 to-laranja-9/35",
    pill: "border-laranja-9 from-laranja-6 to-laranja-3", pillText: "text-laranja-12",
  },
  {
    id: "silver", label: "Silver", min: 26, max: 37,
    emblem: "/wallet-reader/tiers/silver.webp",
    text: "text-gray-11", chipBg: "bg-gray-4", chipBorder: "border-gray-6", meter: "bg-gray-8",
    card: "border-gray-6 bg-[linear-gradient(112.5deg,var(--color-gray-3)_0%,var(--color-gray-1)_100%)]",
    ring: "border-gray-6", bar: "from-gray-6 to-gray-8", corner: "from-gray-9 to-gray-9",
    pill: "border-gray-9 from-gray-7 to-gray-3", pillText: "text-gray-12",
  },
  {
    id: "gold", label: "Gold", min: 38, max: 50,
    emblem: "/wallet-reader/tiers/gold.webp",
    text: "text-principal-11", chipBg: "bg-principal-3", chipBorder: "border-principal-8", meter: "bg-principal-9",
    card: "border-principal-6 bg-[linear-gradient(112.5deg,var(--color-principal-3)_0%,var(--color-principal-1)_100%)]",
    ring: "border-principal-6", bar: "from-principal-6 to-principal-9", corner: "from-principal-9 to-principal-9/75",
    pill: "border-principal-9 from-principal-7 to-principal-3", pillText: "text-principal-12",
  },
  {
    id: "platinum", label: "Platinum", min: 51, max: 62,
    emblem: "/wallet-reader/tiers/platinum.webp",
    text: "text-azul-11", chipBg: "bg-azul-3", chipBorder: "border-azul-7", meter: "bg-azul-9",
    card: "border-azul-6 bg-[linear-gradient(112.5deg,var(--color-azul-3)_0%,var(--color-secundaria-1)_100%)]",
    ring: "border-azul-6", bar: "from-azul-6 to-azul-9", corner: "from-azul-9 to-azul-9/80",
    pill: "border-secundaria-9 from-secundaria-7 to-secundaria-2", pillText: "text-secundaria-12",
  },
  {
    id: "diamond", label: "Diamond", min: 63, max: 75,
    emblem: "/wallet-reader/tiers/diamond.webp",
    text: "text-secundaria-11", chipBg: "bg-secundaria-3", chipBorder: "border-secundaria-7", meter: "bg-secundaria-9",
    card: "border-secundaria-6 bg-[linear-gradient(112.5deg,var(--color-secundaria-2)_0%,var(--color-secundaria-1)_100%)]",
    ring: "border-secundaria-6", bar: "from-secundaria-6 to-secundaria-9", corner: "from-secundaria-9 to-secundaria-9/80",
    pill: "border-azul-9 from-azul-7 to-azul-4", pillText: "text-azul-12",
  },
  {
    id: "alpha", label: "Alpha", min: 76, max: 87,
    emblem: "/wallet-reader/tiers/alpha.webp",
    text: "text-violeta-11", chipBg: "bg-violeta-3", chipBorder: "border-violeta-7", meter: "bg-violeta-9",
    card: "border-violeta-6 bg-[linear-gradient(112.5deg,var(--color-violeta-3)_0%,var(--color-violeta-1)_100%)]",
    ring: "border-violeta-6", bar: "from-violeta-6 to-violeta-9", corner: "from-violeta-9 to-violeta-9/70",
    pill: "border-violeta-9 from-violeta-7 to-violeta-4", pillText: "text-violeta-12",
  },
  {
    id: "super-alpha", label: "Super alpha", min: 88, max: 100,
    emblem: "/wallet-reader/tiers/super-alpha.webp",
    text: "text-principal-11", chipBg: "bg-principal-3", chipBorder: "border-principal-8", meter: "bg-principal-9",
    card: "border-violeta-6 bg-[linear-gradient(112.5deg,var(--color-violeta-3)_0%,var(--color-principal-1)_100%)]",
    ring: "border-violeta-9", bar: "from-violeta-9 to-principal-9", corner: "from-principal-9 to-violeta-9",
    pill: "border-violeta-10 from-violeta-7 to-principal-5",
    // Topo do ranking: o texto também é degradê (violeta → principal).
    pillText: "bg-linear-to-r from-violeta-12 to-principal-12 bg-clip-text text-transparent",
  },
];

export function tierFor(score: number): TierSpec {
  return KOL_TIERS.find((t) => score >= t.min && score <= t.max) ?? KOL_TIERS[0];
}

/** Hash estável (mesmo do app) → índice determinístico. */
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const MEME_AVATARS = [
  "confused-guy", "crying-baby", "doge", "doubt-face", "fire-dog-outline",
  "npc-wojak", "nyan-cat-pixel", "phone-guy", "roll-safe", "screaming-cat",
  "sipping-tea", "skeptical-face-pink", "this-is-fine-dog", "this-is-fine-dog-pink",
  "this-is-fine-dog-purple", "wise-guru", "woman-flower",
] as const;

/** Avatar determinístico por id (meme pack em public/wallet-reader/memes). */
export function memeAvatarFor(id: string): string {
  return `/wallet-reader/memes/${MEME_AVATARS[hashStr(id) % MEME_AVATARS.length]}.png`;
}

/** Src do avatar: custom (data URL) OU meme por hash. */
export function avatarSrc(state: Pick<KolState, "avatar" | "id">): string {
  return state.avatar || memeAvatarFor(state.id);
}

/** Cor (hsl) determinística de um grupo/FnF, pelo id. */
export function groupHue(id: string): number {
  return hashStr(id) % 360;
}

/** Uma carteira sinalizada por um scan de sidewallets/copytraders. */
export interface ScanFlagged {
  address: string;
  name: string | null;
  ownerKolId: string | null;
  ownerKolName: string | null;
  role: "sidewallet" | "copytrader";
  confidence: "high" | "medium" | "info";
  recognizedElsewhere: boolean;
  recognizedAs: string | null;
  signals: string[];
  reason: string;
}

/** Scan sem as evidências — o que a listagem carrega. */
export type ScanSummary = Omit<ScanResult, "flagged">;

/** Resultado de um scan de um KOL (cacheado ou ao vivo). */
export interface ScanResult {
  kolId: string;
  kolName: string;
  scannedAt: number;
  /** `queued`/`running`: a varredura roda em fila no backend e avisa por socket. */
  status: "queued" | "running" | "complete" | "error";
  publicWallet: string;
  tokensAnalyzed: number;
  apiCalls: number;
  flagged: ScanFlagged[];
  summary: string;
}
