"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { KolGroup, KolOverride, KolProfile, KolState, WalletRef } from "@/lib/walletReader/types";

const PROFILES_URL = "/wallet-reader/kol-profiles.json";
const LS_PREFIX = "wr:kol:v1:";
const CUSTOM_IDS_KEY = "wr:custom:ids";
const GROUPS_KEY = "wr:fnf:groups";

// Cache dos perfis-base entre montagens (dados estáticos, imutáveis na sessão).
let profilesCache: KolProfile[] | null = null;

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Lê TODOS os overrides salvos (varre as chaves `wr:kol:v1:*`). */
function loadAllOverrides(): Record<string, KolOverride> {
  const out: Record<string, KolOverride> = {};
  if (typeof window === "undefined") return out;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(LS_PREFIX)) {
      out[k.slice(LS_PREFIX.length)] = readJson<KolOverride>(localStorage.getItem(k), {});
    }
  }
  return out;
}

/** Backup completo (mesmo formato do app original — compatível com import). */
export interface KolBackup {
  version: 1;
  exportedAt: string;
  overrides: Record<string, KolOverride>;
  customIds: string[];
  groups: KolGroup[];
}

/**
 * Fonte única de dados do Wallet Reader: carrega os perfis-base + as edições do
 * usuário (localStorage) e expõe os estados efetivos (base + override) e as ações
 * de mutação. Persistência 100% local — nenhum dado sai do navegador.
 */
export function useKolIndex() {
  const [profiles, setProfiles] = useState<KolProfile[]>(profilesCache ?? []);
  const [loaded, setLoaded] = useState(profilesCache != null);
  const [overrides, setOverrides] = useState<Record<string, KolOverride>>({});
  const [customIds, setCustomIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<KolGroup[]>([]);

  // Carrega perfis (1×) + estado local no mount.
  useEffect(() => {
    let alive = true;
    const hydrate = () => {
      if (typeof window === "undefined") return;
      setOverrides(loadAllOverrides());
      setCustomIds(readJson<string[]>(localStorage.getItem(CUSTOM_IDS_KEY), []));
      setGroups(readJson<KolGroup[]>(localStorage.getItem(GROUPS_KEY), []));
    };
    if (profilesCache) {
      hydrate();
      return;
    }
    fetch(PROFILES_URL)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: KolProfile[]) => {
        if (!alive) return;
        profilesCache = data;
        setProfiles(data);
        setLoaded(true);
        hydrate();
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const baseById = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const groupById = useCallback((id: string) => groups.find((g) => g.id === id) ?? null, [groups]);

  // Estado efetivo de um id (base + override).
  const getState = useCallback(
    (id: string): KolState => {
      const base = baseById.get(id) ?? null;
      const o = overrides[id] ?? {};
      const removed = new Set(o.walletsRemoved ?? []);
      const added = o.walletsAdded ?? [];
      const baseWallets = base?.wallets ?? [];
      const wallets = baseWallets.filter((w) => !removed.has(w.address)).concat(added);
      const name = o.name?.trim() || base?.name || "Sem nome";
      return {
        id,
        name,
        wallets,
        walletCount: wallets.length,
        squads: base?.squads ?? [],
        seedRelevance: base?.seedRelevance ?? 20,
        isCustom: !base,
        relevance: typeof o.relevance === "number" ? o.relevance : (base?.seedRelevance ?? 20),
        types: Array.isArray(o.types) ? o.types : [],
        fnfGroups: Array.isArray(o.fnfGroups) ? o.fnfGroups.filter((gid) => groups.some((g) => g.id === gid)) : [],
        twitter: o.twitter ?? "",
        notes: o.notes ?? "",
        avatar: o.avatar ?? null,
        dismissedSidewallets: Array.isArray(o.dismissedSidewallets) ? o.dismissedSidewallets : [],
      };
    },
    [baseById, overrides, groups],
  );

  const allIds = useMemo(() => {
    const staticIds = profiles.map((p) => p.id);
    return staticIds.concat(customIds).filter((id) => !overrides[id]?.deleted);
  }, [profiles, customIds, overrides]);

  const states = useMemo(() => allIds.map(getState), [allIds, getState]);

  // ── Mutations (state + localStorage) ──
  const patchOverride = useCallback((id: string, patch: KolOverride) => {
    setOverrides((prev) => {
      const next = { ...(prev[id] ?? {}), ...patch, updatedAt: Date.now() };
      try {
        localStorage.setItem(LS_PREFIX + id, JSON.stringify(next));
      } catch {
        // storage cheio — silencioso (o app original só avisa via toast)
      }
      return { ...prev, [id]: next };
    });
  }, []);

  const persistCustomIds = useCallback((next: string[]) => {
    try {
      localStorage.setItem(CUSTOM_IDS_KEY, JSON.stringify(next));
    } catch {
      // ignora
    }
    setCustomIds(next);
  }, []);

  const persistGroups = useCallback((next: KolGroup[]) => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
    } catch {
      // ignora
    }
    setGroups(next);
  }, []);

  const addWallet = useCallback(
    (id: string, name: string, address: string) => {
      const o = overrides[id] ?? {};
      const removed = new Set(o.walletsRemoved ?? []);
      if (removed.has(address)) {
        removed.delete(address);
        patchOverride(id, { walletsRemoved: Array.from(removed) });
      } else {
        patchOverride(id, { walletsAdded: (o.walletsAdded ?? []).concat([{ name, address }]) });
      }
    },
    [overrides, patchOverride],
  );

  const removeWallet = useCallback(
    (id: string, address: string) => {
      const o = overrides[id] ?? {};
      const added = o.walletsAdded ?? [];
      const idx = added.findIndex((w) => w.address === address);
      if (idx >= 0) {
        const next = added.slice();
        next.splice(idx, 1);
        patchOverride(id, { walletsAdded: next });
      } else {
        const removed = new Set(o.walletsRemoved ?? []);
        removed.add(address);
        patchOverride(id, { walletsRemoved: Array.from(removed) });
      }
    },
    [overrides, patchOverride],
  );

  const addKol = useCallback(
    (name: string, wallet?: WalletRef): string => {
      const id = "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      patchOverride(id, {
        name,
        walletsAdded: wallet ? [wallet] : [],
        relevance: 20,
        types: [],
        twitter: "",
        notes: "",
      });
      persistCustomIds(customIds.concat([id]));
      return id;
    },
    [customIds, patchOverride, persistCustomIds],
  );

  const removeKol = useCallback(
    (id: string) => {
      if (!baseById.has(id)) {
        persistCustomIds(customIds.filter((x) => x !== id));
        try {
          localStorage.removeItem(LS_PREFIX + id);
        } catch {
          // ignora
        }
        setOverrides((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        patchOverride(id, { deleted: true });
      }
    },
    [baseById, customIds, patchOverride, persistCustomIds],
  );

  const createGroup = useCallback(
    (name: string): KolGroup => {
      const existing = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing;
      const g: KolGroup = {
        id: "fnf-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name,
      };
      persistGroups(groups.concat([g]));
      return g;
    },
    [groups, persistGroups],
  );

  const renameGroup = useCallback(
    (id: string, name: string) => persistGroups(groups.map((g) => (g.id === id ? { ...g, name } : g))),
    [groups, persistGroups],
  );

  const deleteGroup = useCallback(
    (id: string) => {
      persistGroups(groups.filter((g) => g.id !== id));
      // Remove o grupo de todos os KOLs que o tinham.
      Object.entries(overrides).forEach(([kolId, o]) => {
        if (Array.isArray(o.fnfGroups) && o.fnfGroups.includes(id)) {
          patchOverride(kolId, { fnfGroups: o.fnfGroups.filter((g) => g !== id) });
        }
      });
    },
    [groups, overrides, persistGroups, patchOverride],
  );

  const groupMembers = useCallback(
    (id: string) =>
      allIds
        .filter((kolId) => overrides[kolId]?.fnfGroups?.includes(id))
        .map(getState)
        .sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name)),
    [allIds, overrides, getState],
  );

  const exportBackup = useCallback((): KolBackup => {
    const out: Record<string, KolOverride> = {};
    allIds.forEach((id) => {
      const o = overrides[id];
      if (o && Object.keys(o).length) out[id] = o;
    });
    return { version: 1, exportedAt: new Date().toISOString(), overrides: out, customIds, groups };
  }, [allIds, overrides, customIds, groups]);

  const importBackup = useCallback(
    (parsed: Partial<KolBackup>): number => {
      const imported = parsed.overrides ?? {};
      Object.entries(imported).forEach(([id, o]) => {
        try {
          localStorage.setItem(LS_PREFIX + id, JSON.stringify(o));
        } catch {
          // ignora
        }
      });
      setOverrides((prev) => ({ ...prev, ...imported }));
      if (Array.isArray(parsed.customIds)) {
        persistCustomIds(Array.from(new Set(customIds.concat(parsed.customIds))));
      }
      if (Array.isArray(parsed.groups)) {
        const byId = new Map(groups.map((g) => [g.id, g]));
        parsed.groups.forEach((g) => g?.id && byId.set(g.id, g));
        persistGroups(Array.from(byId.values()));
      }
      return Object.keys(imported).length;
    },
    [customIds, groups, persistCustomIds, persistGroups],
  );

  const reset = useCallback(() => {
    profiles.forEach((p) => {
      try {
        localStorage.removeItem(LS_PREFIX + p.id);
      } catch {
        // ignora
      }
    });
    customIds.forEach((id) => {
      try {
        localStorage.removeItem(LS_PREFIX + id);
      } catch {
        // ignora
      }
    });
    persistCustomIds([]);
    persistGroups([]);
    setOverrides({});
  }, [profiles, customIds, persistCustomIds, persistGroups]);

  return {
    loaded,
    profiles,
    states,
    groups,
    getState,
    groupById,
    groupMembers,
    patchOverride,
    addWallet,
    removeWallet,
    addKol,
    removeKol,
    createGroup,
    renameGroup,
    deleteGroup,
    exportBackup,
    importBackup,
    reset,
  };
}
