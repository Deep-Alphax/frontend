import type { WalletRef } from "@/lib/walletReader/types";
import { WALLET_CHAINS, addressFamily, chainsForAddress } from "@/lib/walletReader/chains";

/**
 * Leitura do arquivo de backup de KOLs ANTES de mandar ao servidor.
 *
 * O backend valida com `whitelist` + `forbidNonWhitelisted`: um campo a mais
 * (ex.: o `updatedAt` que os backups da era localStorage traziam) ou um valor
 * fora do DTO faz o servidor recusar o arquivo INTEIRO com 400. Era esse o
 * "import não funciona". Aqui o arquivo é reduzido ao formato que o DTO aceita:
 * só os campos conhecidos, nos mesmos tetos do backend (`dto/kol.dto.ts`), e o
 * que não tem conserto é descartado por campo, não por arquivo.
 *
 * Isto NÃO é a barreira de segurança — o servidor continua validando tudo. É
 * só o que transforma um arquivo antigo/torto em um pedido que ele aceite.
 */

/** Um override como o import envia (`kolId` no corpo). */
export interface KolImportOverride {
  kolId: string;
  name?: string | null;
  relevance?: number | null;
  types?: string[] | null;
  squads?: string[] | null;
  /** Só em backups antigos: ids de grupo, traduzidos pelo servidor via `groups`. */
  fnfGroups?: string[] | null;
  twitter?: string | null;
  notes?: string | null;
  avatar?: string | null;
  walletsAdded?: WalletRef[] | null;
  walletsRemoved?: string[] | null;
  dismissedSidewallets?: string[] | null;
  deleted?: boolean;
  /**
   * Veio da lista `kols` do export (o KOL inteiro, não uma edição): o servidor
   * só cria se ele ainda não existir na conta — reimportar o próprio export
   * não vira edição.
   */
  ifMissing?: boolean;
}

export interface KolImportPayload {
  overrides: KolImportOverride[];
  /** Só em backups antigos (tabela id → nome dos squads). */
  groups?: { id: string; name: string }[];
}

/** Erro com mensagem já pronta para o usuário. */
export class KolBackupError extends Error {}

// Tetos espelhados de `backend/src/app/wallet-reader/dto/kol.dto.ts`.
const MAX_ID = 120;
const MAX_NAME = 120;
const MAX_TYPE = 40;
const MAX_SQUAD = 80;
const MAX_TAGS = 40;
const MAX_TWITTER = 40;
const MAX_NOTES = 4000;
const MAX_WALLETS = 200;
const MAX_WALLET_FIELD = 120;
const MAX_GROUPS = 200;
const AVATAR_MAX = 400_000;
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** `undefined` = campo fica de fora (não mexe no que a conta já tem). */
function str(v: unknown, max: number): string | null | undefined {
  if (v === null) return null;
  return typeof v === "string" ? v.slice(0, max) : undefined;
}

function strList(v: unknown, maxLen: number, maxItems: number): string[] | null | undefined {
  if (v === null) return null;
  if (!Array.isArray(v)) return undefined;
  return v
    .filter((s): s is string => typeof s === "string" && s.trim() !== "")
    .map((s) => s.slice(0, maxLen))
    .slice(0, maxItems);
}

function relevance(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** `""` = foto removida (volta ao avatar por hash). SVG/caminho/URL são descartados. */
function avatar(v: unknown): string | null | undefined {
  if (v === null || v === "") return v;
  if (typeof v !== "string" || v.length > AVATAR_MAX) return undefined;
  return AVATAR_DATA_URL.test(v) ? v : undefined;
}

function wallets(v: unknown): WalletRef[] | null | undefined {
  if (v === null) return null;
  if (!Array.isArray(v)) return undefined;
  const out: WalletRef[] = [];
  for (const w of v) {
    if (!isObj(w) || typeof w.address !== "string" || !w.address.trim()) continue;
    const address = w.address.trim().slice(0, MAX_WALLET_FIELD);
    // Rede só entra se for conhecida E bater com o endereço — o backend
    // recusaria o lote inteiro por uma rede inválida.
    const chain = WALLET_CHAINS.find((c) => c === w.chain);
    out.push({
      name: (typeof w.name === "string" ? w.name : "").slice(0, MAX_WALLET_FIELD),
      address,
      ...(chain && chainsForAddress(address).includes(chain) && addressFamily(address)
        ? { chain }
        : {}),
    });
  }
  return out.slice(0, MAX_WALLETS);
}

/** Um override do arquivo → o formato do DTO. `null` = linha sem conserto. */
export function normalizeOverride(kolId: unknown, raw: unknown): KolImportOverride | null {
  if (typeof kolId !== "string" || !kolId.trim() || kolId.length > MAX_ID) return null;
  if (!isObj(raw)) return null;

  const fields: Omit<KolImportOverride, "kolId"> = {
    name: str(raw.name, MAX_NAME),
    relevance: relevance(raw.relevance),
    types: strList(raw.types, MAX_TYPE, MAX_TAGS),
    squads: strList(raw.squads, MAX_SQUAD, MAX_TAGS),
    fnfGroups: strList(raw.fnfGroups, MAX_SQUAD, MAX_TAGS),
    twitter: str(raw.twitter, MAX_TWITTER),
    notes: str(raw.notes, MAX_NOTES),
    avatar: avatar(raw.avatar),
    walletsAdded: wallets(raw.walletsAdded),
    walletsRemoved: strList(raw.walletsRemoved, MAX_WALLET_FIELD, MAX_WALLETS),
    dismissedSidewallets: strList(raw.dismissedSidewallets, MAX_WALLET_FIELD, MAX_WALLETS),
    deleted: typeof raw.deleted === "boolean" ? raw.deleted : undefined,
  };

  const out: KolImportOverride = { kolId };
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v;
  }
  return out;
}

function groups(v: unknown): { id: string; name: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter(
      (g): g is { id: string; name: string } =>
        isObj(g) && typeof g.id === "string" && typeof g.name === "string" && g.name.trim() !== "",
    )
    .map((g) => ({ id: g.id.slice(0, MAX_SQUAD), name: g.name.slice(0, MAX_SQUAD) }))
    .slice(0, MAX_GROUPS);
  return out.length ? out : undefined;
}

/**
 * Texto do arquivo → pedido de import. Aceita o formato do export
 * (`overrides` como objeto `{ [kolId]: override }`) e também uma lista
 * (`overrides: [{ kolId, ... }]`). A lista `kols` (export filtrado) vira
 * "cria se faltar" para cada KOL sem edição no arquivo — é o que leva um
 * recorte de KOLs para outra conta.
 *
 * @throws KolBackupError quando o arquivo não é um backup de KOLs.
 */
export function parseKolBackup(text: string): KolImportPayload & { skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new KolBackupError("This file is not valid JSON.");
  }
  if (!isObj(parsed) || !("overrides" in parsed || "kols" in parsed)) {
    throw new KolBackupError("This file is not a KOL backup (no \"overrides\" found).");
  }

  const entries: [unknown, unknown][] = Array.isArray(parsed.overrides)
    ? parsed.overrides.map((o) => [isObj(o) ? o.kolId : undefined, o])
    : isObj(parsed.overrides)
      ? Object.entries(parsed.overrides)
      : [];

  const overrides: KolImportOverride[] = [];
  let skipped = 0;
  for (const [kolId, raw] of entries) {
    const o = normalizeOverride(kolId, raw);
    if (o) overrides.push(o);
    else skipped++;
  }

  // `kols`: o estado inteiro de cada KOL exportado. Quem já tem edição no
  // arquivo vai pelo override acima; os demais entram como "cria se faltar".
  const edited = new Set(overrides.map((o) => o.kolId));
  for (const k of Array.isArray(parsed.kols) ? parsed.kols : []) {
    if (!isObj(k) || typeof k.id !== "string" || edited.has(k.id)) continue;
    const o = normalizeOverride(k.id, {
      name: k.name,
      relevance: k.relevance,
      types: k.types,
      squads: k.squads,
      twitter: k.twitter,
      notes: k.notes,
      walletsAdded: k.wallets,
    });
    if (o) {
      overrides.push({ ...o, ifMissing: true });
      edited.add(k.id);
    } else skipped++;
  }

  return { overrides, groups: groups(parsed.groups), skipped };
}

/** Teto do servidor por pedido (`ArrayMaxSize` do DTO). */
const MAX_PER_REQUEST = 5000;
/**
 * Bytes por pedido. O body do backend aceita até 5 MB, e cada avatar pode ter
 * ~400 KB: um backup com uma dúzia de fotos passava do limite e virava 413.
 * 2 MB deixa folga para o JSON do envelope.
 */
const MAX_BYTES_PER_REQUEST = 2_000_000;

/**
 * Parte o import em lotes que caibam no corpo do servidor. O import é upsert
 * por (conta, kolId) — idempotente —, então mandar em várias chamadas é seguro
 * e repetir um lote que falhou não duplica nada.
 */
export function chunkOverrides(
  overrides: KolImportOverride[],
  maxBytes = MAX_BYTES_PER_REQUEST,
  maxItems = MAX_PER_REQUEST,
): KolImportOverride[][] {
  const chunks: KolImportOverride[][] = [];
  let current: KolImportOverride[] = [];
  let bytes = 0;
  for (const o of overrides) {
    const size = JSON.stringify(o).length;
    if (current.length && (bytes + size > maxBytes || current.length >= maxItems)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(o);
    bytes += size;
  }
  if (current.length) chunks.push(current);
  return chunks;
}

/** Nome do arquivo exportado, com a data (backups do mesmo dia se sobrescrevem). */
export function backupFilename(now = new Date()): string {
  return `kol-index-backup-${now.toISOString().slice(0, 10)}.json`;
}
