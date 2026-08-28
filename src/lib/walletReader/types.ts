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
 * Faixas de relevância (0–100). Cores mapeadas do app original p/ o DS:
 * Low=cinza, Medium=verde, High=azul(ciano), Alpha=violeta, Super Alpha=dourado.
 * Classes LITERAIS (Tailwind v4 só emite o que é estático).
 */
export interface TierSpec {
  id: string;
  label: string;
  min: number;
  max: number;
  /** Cor do texto (pílula/nº). */
  text: string;
  /** Fundo sutil da pílula. */
  chipBg: string;
  chipBorder: string;
  /** Cor da barra de relevância. */
  meter: string;
  /** Pílula de categoria do card (gradiente + borda + texto), como no Figma. */
  pill: string;
}

export const KOL_TIERS: TierSpec[] = [
  { id: "comum", label: "Low", min: 0, max: 24, text: "text-gray-11", chipBg: "bg-gray-4", chipBorder: "border-gray-6", meter: "bg-gray-8", pill: "border-gray-7 from-gray-6 to-gray-3 text-gray-12" },
  { id: "incomum", label: "Medium", min: 25, max: 49, text: "text-green-11", chipBg: "bg-green-3", chipBorder: "border-green-7", meter: "bg-green-9", pill: "border-green-9 from-green-8 to-green-3 text-green-12" },
  { id: "raro", label: "High", min: 50, max: 69, text: "text-azul-11", chipBg: "bg-azul-3", chipBorder: "border-azul-7", meter: "bg-azul-9", pill: "border-azul-9 from-azul-8 to-azul-3 text-azul-12" },
  { id: "epico", label: "Alpha", min: 70, max: 84, text: "text-violeta-11", chipBg: "bg-violeta-3", chipBorder: "border-violeta-7", meter: "bg-violeta-9", pill: "border-violeta-9 from-violeta-8 to-violeta-3 text-violeta-12" },
  { id: "lendario", label: "Super Alpha", min: 85, max: 100, text: "text-principal-11", chipBg: "bg-principal-3", chipBorder: "border-principal-8", meter: "bg-principal-9", pill: "border-principal-8 from-principal-7 to-principal-3 text-principal-12" },
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
