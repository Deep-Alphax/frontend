(function () {
  const STATIC_PROFILES = window.KOL_PROFILES || [];

  /* ---------- sidewallet/copytrader scans (cached results + live scan trigger) ---------- */
  let SCANS = { scans: {} };
  function loadScans() {
    return fetch('assets/data/sidewallet-scans.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { scans: {} }))
      .then((data) => { SCANS = data && data.scans ? data : { scans: {} }; })
      .catch(() => { SCANS = { scans: {} }; });
  }
  async function runSidewalletScan(id) {
    const res = await fetch('/api/scan/' + encodeURIComponent(id), { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || ('HTTP ' + res.status));
    }
    const result = await res.json();
    SCANS.scans[id] = result;
    return result;
  }

  const TYPES = [
    { id: 'trencher', label: 'Trencher', hue: 340 },
    { id: 'whale', label: 'Whale', hue: 200 },
    { id: 'alpha', label: 'Alpha Caller', hue: 80 },
    { id: 'sniper', label: 'Sniper', hue: 20 },
    { id: 'farmer', label: 'Farmer', hue: 150 },
    { id: 'insider', label: 'Insider', hue: 260 },
    { id: 'rugger', label: 'Rugger', hue: 0 },
    { id: 'degen', label: 'Degen', hue: 300 },
    { id: 'copytrader', label: 'Copytrader', hue: 230 },
    { id: 'dev', label: 'Dev', hue: 45 },
    { id: 'alphadev', label: 'Alpha Dev', hue: 110 },
    { id: 'influencer', label: 'Influencer', hue: 180 },
  ];
  const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.id, t]));

  const TIERS = [
    { id: 'comum', label: 'Low', min: 0, max: 24, v: '--t-comum' },
    { id: 'incomum', label: 'Medium', min: 25, max: 49, v: '--t-incomum' },
    { id: 'raro', label: 'High', min: 50, max: 69, v: '--t-raro' },
    { id: 'epico', label: 'Alpha', min: 70, max: 84, v: '--t-epico' },
    { id: 'lendario', label: 'Super Alpha', min: 85, max: 100, v: '--t-lendario' },
  ];
  function tierFor(score) { return TIERS.find((t) => score >= t.min && score <= t.max) || TIERS[0]; }

  const LS_PREFIX = 'wr:kol:v1:';
  const CUSTOM_IDS_KEY = 'wr:custom:ids';
  const GROUPS_KEY = 'wr:fnf:groups';

  function loadGroups() { try { return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]'); } catch (e) { return []; } }
  function saveGroups(list) { localStorage.setItem(GROUPS_KEY, JSON.stringify(list)); }
  function groupById(id) { return loadGroups().find((g) => g.id === id) || null; }
  function groupHue(id) { return hashStr(id) % 360; }
  function createGroup(name) {
    const list = loadGroups();
    const existing = list.find((g) => g.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const g = { id: 'fnf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name };
    list.push(g);
    saveGroups(list);
    return g;
  }
  function renameGroup(id, name) {
    const list = loadGroups();
    const g = list.find((x) => x.id === id);
    if (!g) return;
    g.name = name;
    saveGroups(list);
  }
  function deleteGroup(id) {
    const list = loadGroups().filter((g) => g.id !== id);
    saveGroups(list);
    activeFnfFilter.delete(id);
    allIds().forEach((kolId) => {
      const o = loadOverride(kolId);
      if (Array.isArray(o.fnfGroups) && o.fnfGroups.includes(id)) {
        saveOverride(kolId, { fnfGroups: o.fnfGroups.filter((g) => g !== id) });
      }
    });
  }
  function groupMemberCount(id) {
    return allIds().filter((kolId) => {
      const o = loadOverride(kolId);
      return Array.isArray(o.fnfGroups) && o.fnfGroups.includes(id);
    }).length;
  }
  function groupMembers(id) {
    return allIds()
      .filter((kolId) => {
        const o = loadOverride(kolId);
        return Array.isArray(o.fnfGroups) && o.fnfGroups.includes(id);
      })
      .map(getState)
      .sort((a, b) => b.relevance - a.relevance || a.name.localeCompare(b.name));
  }

  function loadOverride(id) {
    try { const raw = localStorage.getItem(LS_PREFIX + id); return raw ? JSON.parse(raw) : {}; } catch (e) { return {}; }
  }
  function saveOverride(id, patch) {
    const cur = loadOverride(id);
    const next = Object.assign({}, cur, patch, { updatedAt: Date.now() });
    try { localStorage.setItem(LS_PREFIX + id, JSON.stringify(next)); return true; }
    catch (e) { toast('Armazenamento cheio — exporte um backup e limpe edições antigas.'); return false; }
  }
  function loadCustomIds() { try { return JSON.parse(localStorage.getItem(CUSTOM_IDS_KEY) || '[]'); } catch (e) { return []; } }
  function saveCustomIds(list) { localStorage.setItem(CUSTOM_IDS_KEY, JSON.stringify(list)); }

  function baseProfile(id) { return STATIC_PROFILES.find((p) => p.id === id) || null; }

  function allIds() {
    const staticIds = STATIC_PROFILES.map((p) => p.id);
    const customIds = loadCustomIds();
    return staticIds.concat(customIds).filter((id) => {
      const o = loadOverride(id);
      return !o.deleted;
    });
  }

  function getState(id) {
    const base = baseProfile(id);
    const o = loadOverride(id);
    const removed = new Set(o.walletsRemoved || []);
    const added = o.walletsAdded || [];
    const baseWallets = base ? base.wallets : [];
    const wallets = baseWallets.filter((w) => !removed.has(w.address)).concat(added);
    const name = (typeof o.name === 'string' && o.name.trim()) ? o.name.trim() : (base ? base.name : 'Sem nome');
    return {
      id, name,
      wallets, walletCount: wallets.length,
      squads: base ? base.squads : [],
      seedRelevance: base ? base.seedRelevance : 20,
      isCustom: !base,
      relevance: (typeof o.relevance === 'number') ? o.relevance : (base ? base.seedRelevance : 20),
      types: Array.isArray(o.types) ? o.types : [],
      fnfGroups: Array.isArray(o.fnfGroups) ? o.fnfGroups.filter((gid) => groupById(gid)) : [],
      twitter: o.twitter || '',
      notes: o.notes || '',
      avatar: o.avatar || null,
      dismissedSidewallets: Array.isArray(o.dismissedSidewallets) ? o.dismissedSidewallets : [],
    };
  }

  /* ---------- avatar: meme pack, assigned per KOL ---------- */
  function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  const MEME_AVATARS = [
    'assets/memes/confused-guy.png',
    'assets/memes/crying-baby.png',
    'assets/memes/doge.png',
    'assets/memes/doubt-face.png',
    'assets/memes/fire-dog-outline.png',
    'assets/memes/npc-wojak.png',
    'assets/memes/nyan-cat-pixel.png',
    'assets/memes/phone-guy.png',
    'assets/memes/roll-safe.png',
    'assets/memes/screaming-cat.png',
    'assets/memes/sipping-tea.png',
    'assets/memes/skeptical-face-pink.png',
    'assets/memes/this-is-fine-dog.png',
    'assets/memes/this-is-fine-dog-pink.png',
    'assets/memes/this-is-fine-dog-purple.png',
    'assets/memes/wise-guru.png',
    'assets/memes/woman-flower.png',
  ];
  function memeAvatarFor(id) { return MEME_AVATARS[hashStr(id) % MEME_AVATARS.length]; }
  function avatarSrc(state) { return state.avatar || memeAvatarFor(state.id); }

  /* ---------- sound ---------- */
  let actx = null;
  function ac() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return actx; }
  function tone(freq, start, dur, type, gain) {
    const a = ac(); if (!a) return;
    const osc = a.createOscillator(); const g = a.createGain();
    osc.type = type || 'sine'; osc.frequency.value = freq;
    g.gain.value = 0;
    osc.connect(g); g.connect(a.destination);
    const t0 = a.currentTime + start;
    g.gain.linearRampToValueAtTime(gain || 0.05, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  function playCoin() { tone(880, 0, .08, 'square', .045); tone(1320, .06, .11, 'square', .035); }
  function playTick() { tone(700, 0, .05, 'sine', .035); }
  function playRemove() { tone(420, 0, .09, 'sawtooth', .035); tone(280, .07, .12, 'sawtooth', .03); }
  function playSuccess() { tone(660, 0, .09, 'triangle', .05); tone(990, .08, .13, 'triangle', .045); tone(1320, .16, .2, 'triangle', .04); }

  /* ---------- toast ---------- */
  function toast(msg, opts) {
    const host = document.getElementById('toastHost');
    const el = document.createElement('div'); el.className = 'toast';
    const span = document.createElement('span'); span.textContent = msg;
    el.appendChild(span);
    if (opts && opts.actionLabel) {
      const b = document.createElement('button'); b.textContent = opts.actionLabel;
      b.addEventListener('click', () => { opts.onAction && opts.onAction(); el.remove(); });
      el.appendChild(b);
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), opts && opts.actionLabel ? 5000 : 2600);
  }

  /* ---------- generic confirm dialog ---------- */
  const confirmOverlay = document.getElementById('confirmOverlay');
  let confirmResolve = null;
  function openConfirm({ title, message, confirmLabel }) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmOkBtn').textContent = confirmLabel || 'Confirmar';
    confirmOverlay.classList.add('open');
    return new Promise((resolve) => { confirmResolve = resolve; });
  }
  function closeConfirmWith(result) {
    confirmOverlay.classList.remove('open');
    if (confirmResolve) { confirmResolve(result); confirmResolve = null; }
  }
  document.getElementById('confirmCancelBtn').addEventListener('click', () => closeConfirmWith(false));
  document.getElementById('closeConfirm').addEventListener('click', () => closeConfirmWith(false));
  document.getElementById('confirmOkBtn').addEventListener('click', () => closeConfirmWith(true));
  confirmOverlay.addEventListener('click', (e) => { if (e.target === confirmOverlay) closeConfirmWith(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmOverlay.classList.contains('open')) closeConfirmWith(false);
  });

  function downloadFile(filename, data, mime) {
    const blob = new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------- wallet selection ---------- */
  const selectedWallets = new Map(); // key: kolId+'|'+address -> {kolId,address,name}
  function toggleWalletSelect(kolId, w, rowEl) {
    const key = kolId + '|' + w.address;
    if (selectedWallets.has(key)) {
      selectedWallets.delete(key);
      rowEl.classList.remove('selected');
    } else {
      selectedWallets.set(key, { kolId, address: w.address, name: w.name });
      rowEl.classList.add('selected');
      playTick();
    }
    updateSelectionBar();
  }
  function updateSelectionBar() {
    const bar = document.getElementById('selectionBar');
    const n = selectedWallets.size;
    bar.style.display = n ? 'flex' : 'none';
    document.getElementById('selectionCount').textContent = n + (n === 1 ? ' carteira selecionada' : ' carteiras selecionadas');
  }
  function buildExportPayload() {
    const arr = [];
    selectedWallets.forEach(({ kolId, address, name }) => {
      const base = baseProfile(kolId);
      const state = getState(kolId);
      const groups = Array.from(new Set(['Main'].concat(base ? state.squads : [])));
      arr.push({
        trackedWalletAddress: address,
        name: name,
        emoji: '🔔',
        alertsOnToast: true,
        alertsOnBubble: true,
        alertsOnFeed: true,
        groups: groups,
        sound: 'default',
      });
    });
    return JSON.stringify(arr, null, 2);
  }
  document.getElementById('clearSelectionBtn').addEventListener('click', () => {
    selectedWallets.clear();
    updateSelectionBar();
    if (overlay.classList.contains('open') && currentProfileId) renderProfile(currentProfileId);
  });
  document.getElementById('copySelectionBtn').addEventListener('click', () => {
    const payload = buildExportPayload();
    const n = selectedWallets.size;
    const done = () => { playSuccess(); toast('Copiado (' + n + ' carteira' + (n !== 1 ? 's' : '') + ')'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(done).catch(done); else done();
  });
  document.getElementById('exportSelectionBtn').addEventListener('click', () => {
    const payload = buildExportPayload();
    const n = selectedWallets.size;
    downloadFile('wallets-selecionadas.txt', payload, 'text/plain');
    playSuccess();
    toast('Exportado (' + n + ' carteira' + (n !== 1 ? 's' : '') + ')');
  });

  /* ---------- filters/sort state ---------- */
  const grid = document.getElementById('grid');
  const emptyEl = document.getElementById('empty');
  const countEl = document.getElementById('count');
  let activeTierFilter = new Set();
  let activeTypeFilter = new Set();
  let activeSquadFilter = new Set();
  let activeFnfFilter = new Set();
  let sortMode = 'relevance';
  let searchQ = '';
  let currentList = [];

  function buildFilterChips() {
    const tierRow = document.getElementById('tierFilterRow');
    TIERS.slice().reverse().forEach((t) => {
      const c = document.createElement('span'); c.className = 'chip';
      const dot = document.createElement('span'); dot.className = 'dot';
      c.style.setProperty('--chip-color', `var(${t.v})`);
      c.append(dot, document.createTextNode(t.label));
      c.addEventListener('click', () => {
        if (activeTierFilter.has(t.id)) activeTierFilter.delete(t.id); else activeTierFilter.add(t.id);
        c.classList.toggle('active'); render();
      });
      tierRow.appendChild(c);
    });
    const typeRow = document.getElementById('typeFilterRow');
    TYPES.forEach((t) => {
      const c = document.createElement('span'); c.className = 'chip';
      const dot = document.createElement('span'); dot.className = 'dot';
      c.style.setProperty('--chip-color', `hsl(${t.hue} 55% 48%)`);
      c.append(dot, document.createTextNode(t.label));
      c.addEventListener('click', () => {
        if (activeTypeFilter.has(t.id)) activeTypeFilter.delete(t.id); else activeTypeFilter.add(t.id);
        c.classList.toggle('active'); render();
      });
      typeRow.appendChild(c);
    });
    refreshSquadChips();
    refreshFnfChips();
  }
  function refreshSquadChips() {
    const squadRow = document.getElementById('squadFilterRow');
    squadRow.innerHTML = '<span class="filter-label">Squad</span>';
    const squads = Array.from(new Set(STATIC_PROFILES.flatMap((p) => p.squads))).sort();
    squads.forEach((s) => {
      const c = document.createElement('span'); c.className = 'chip' + (activeSquadFilter.has(s) ? ' active' : '');
      const dot = document.createElement('span'); dot.className = 'dot';
      c.style.setProperty('--chip-color', 'var(--t-raro)');
      c.append(dot, document.createTextNode(s));
      c.addEventListener('click', () => {
        if (activeSquadFilter.has(s)) activeSquadFilter.delete(s); else activeSquadFilter.add(s);
        c.classList.toggle('active'); render();
      });
      squadRow.appendChild(c);
    });
  }
  function refreshFnfChips() {
    const fnfRow = document.getElementById('fnfFilterRow');
    fnfRow.innerHTML = '<span class="filter-label">Grupo / FnF</span>';
    const groups = loadGroups();
    if (!groups.length) {
      const hint = document.createElement('span');
      hint.style.cssText = 'font-size:12px; color:var(--ink-faint);';
      hint.textContent = 'nenhum grupo criado ainda';
      fnfRow.appendChild(hint);
      return;
    }
    groups.forEach((g) => {
      const c = document.createElement('span'); c.className = 'chip' + (activeFnfFilter.has(g.id) ? ' active' : '');
      const dot = document.createElement('span'); dot.className = 'dot';
      const hue = groupHue(g.id);
      c.style.setProperty('--chip-color', `hsl(${hue} 55% 48%)`);
      c.append(dot, document.createTextNode(g.name));
      c.addEventListener('click', () => {
        if (activeFnfFilter.has(g.id)) activeFnfFilter.delete(g.id); else activeFnfFilter.add(g.id);
        c.classList.toggle('active'); render();
      });
      fnfRow.appendChild(c);
    });
  }

  function matches(state) {
    if (searchQ) {
      const hay = (state.name + ' ' + state.wallets.map((w) => w.name + ' ' + w.address).join(' ')).toLowerCase();
      if (!hay.includes(searchQ)) return false;
    }
    if (activeTierFilter.size && !activeTierFilter.has(tierFor(state.relevance).id)) return false;
    if (activeTypeFilter.size && !state.types.some((t) => activeTypeFilter.has(t))) return false;
    if (activeSquadFilter.size && !state.squads.some((s) => activeSquadFilter.has(s))) return false;
    if (activeFnfFilter.size && !state.fnfGroups.some((g) => activeFnfFilter.has(g))) return false;
    return true;
  }
  function sortList(list) {
    const arr = list.slice();
    if (sortMode === 'name') arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortMode === 'wallets') arr.sort((a, b) => b.walletCount - a.walletCount);
    else if (sortMode === 'tier') arr.sort((a, b) => TIERS.findIndex((t) => t.id === tierFor(b.relevance).id) - TIERS.findIndex((t) => t.id === tierFor(a.relevance).id) || b.relevance - a.relevance);
    else arr.sort((a, b) => b.relevance - a.relevance);
    return arr;
  }

  function cardEl(state, idx) {
    const tier = tierFor(state.relevance);
    const card = document.createElement('div');
    card.className = 'card tier-' + tier.id;
    card.style.setProperty('--tier-color', `var(${tier.v})`);
    card.style.animationDelay = (Math.min(idx, 20) * 10) + 'ms';

    const rm = document.createElement('button'); rm.className = 'card-remove'; rm.textContent = '✕'; rm.title = 'Remover KOL';
    rm.addEventListener('click', (e) => { e.stopPropagation(); removeKol(state.id); });
    card.appendChild(rm);

    const top = document.createElement('div'); top.className = 'card-top';
    const av = document.createElement('div'); av.className = 'avatar-wrap';
    const img = document.createElement('img'); img.className = 'avatar' + (state.avatar ? ' avatar-custom' : ''); img.src = avatarSrc(state); img.alt = '';
    av.appendChild(img);
    const headTxt = document.createElement('div'); headTxt.className = 'card-head-txt';
    const name = document.createElement('div'); name.className = 'card-name'; name.textContent = state.name;
    const pill = document.createElement('span'); pill.className = 'tier-pill'; pill.style.setProperty('--tier-color', `var(${tier.v})`); pill.textContent = tier.label;
    headTxt.append(name, pill);
    if (state.squads.length) {
      const sb = document.createElement('span'); sb.className = 'squad-badge'; sb.textContent = state.squads.join(' · ');
      headTxt.appendChild(sb);
    }
    top.append(av, headTxt);

    const meter = document.createElement('div'); meter.className = 'meter';
    const bar = document.createElement('i'); bar.style.width = state.relevance + '%'; bar.style.setProperty('--tier-color', `var(${tier.v})`);
    meter.appendChild(bar);

    const meta = document.createElement('div'); meta.className = 'card-meta';
    const relSpan = document.createElement('span'); relSpan.innerHTML = '<b>' + state.relevance + '</b>/100 relevância';
    const wSpan = document.createElement('span'); wSpan.innerHTML = '<b>' + state.walletCount + '</b> carteira' + (state.walletCount !== 1 ? 's' : '');
    meta.append(relSpan, wSpan);

    card.append(top, meter, meta);

    if (state.twitter) {
      const tw = document.createElement('div'); tw.className = 'card-twitter'; tw.textContent = '@' + state.twitter.replace(/^@/, '');
      card.appendChild(tw);
    }

    const chips = document.createElement('div'); chips.className = 'type-chips';
    if (state.types.length) {
      state.types.slice(0, 3).forEach((tid) => {
        const tg = document.createElement('span'); tg.className = 'type-tag'; tg.textContent = TYPE_MAP[tid] ? TYPE_MAP[tid].label : tid;
        chips.appendChild(tg);
      });
      if (state.types.length > 3) {
        const more = document.createElement('span'); more.className = 'type-tag'; more.textContent = '+' + (state.types.length - 3);
        chips.appendChild(more);
      }
    } else {
      const tg = document.createElement('span'); tg.className = 'type-tag unset'; tg.textContent = 'sem tipo definido';
      chips.appendChild(tg);
    }
    card.appendChild(chips);

    if (state.fnfGroups.length) {
      const gchips = document.createElement('div'); gchips.className = 'type-chips'; gchips.style.marginTop = '6px';
      state.fnfGroups.forEach((gid) => {
        const g = groupById(gid); if (!g) return;
        const tg = document.createElement('span'); tg.className = 'type-tag';
        const hue = groupHue(gid);
        tg.style.color = `hsl(${hue} 65% 62%)`;
        tg.style.borderColor = `hsl(${hue} 55% 38%)`;
        tg.textContent = g.name;
        gchips.appendChild(tg);
      });
      card.appendChild(gchips);
    }

    const scan = SCANS.scans && SCANS.scans[state.id];
    const dismissedForCard = new Set(state.dismissedSidewallets || []);
    const sidewalletCount = scan && scan.flagged
      ? scan.flagged.filter((f) => f.role === 'sidewallet' && !dismissedForCard.has(f.address)).length
      : 0;
    const sideBtn = document.createElement('button');
    sideBtn.type = 'button';
    sideBtn.className = 'card-scan-btn' + (sidewalletCount ? ' has-findings' : '');
    sideBtn.textContent = sidewalletCount
      ? `🔎 ${sidewalletCount} sidewallet${sidewalletCount > 1 ? 's' : ''} suspeita${sidewalletCount > 1 ? 's' : ''}`
      : '🔎 Identificar sidewallets/copytraders';
    sideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfile(state.id, { scrollToSidewallets: true });
    });
    card.appendChild(sideBtn);

    card.addEventListener('click', () => openProfile(state.id));
    return card;
  }

  function buildStats() {
    const ids = allIds();
    const states = ids.map(getState);
    const totalWallets = states.reduce((s, st) => s + st.walletCount, 0);
    const classified = states.filter((st) => st.types.length > 0).length;
    const withTwitter = states.filter((st) => st.twitter).length;
    const groupCount = loadGroups().length;
    const row = document.getElementById('statsRow');
    row.innerHTML = '';
    [
      [states.length, 'KOLs na coleção'],
      [totalWallets, 'Carteiras rastreadas'],
      [classified, 'Já classificados'],
      [withTwitter, 'Com twitter preenchido'],
      [groupCount, 'Grupos / FnFs criados'],
    ].forEach(([n, l]) => {
      const s = document.createElement('div'); s.className = 'stat';
      const b = document.createElement('b'); b.textContent = n;
      const span = document.createElement('span'); span.textContent = l;
      s.append(b, span); row.appendChild(s);
    });
    const footerCount = document.getElementById('footerCount');
    if (footerCount) footerCount.textContent = STATIC_PROFILES.length + ' KOLs · ' + STATIC_PROFILES.reduce((s, p) => s + p.wallets.length, 0) + ' carteiras';
  }

  function render() {
    grid.innerHTML = '';
    const ids = allIds();
    const states = ids.map(getState).filter(matches);
    const sorted = sortList(states);
    currentList = sorted.map((s) => s.id);
    countEl.textContent = sorted.length + (sorted.length === 1 ? ' kol' : ' kols');
    emptyEl.style.display = sorted.length ? 'none' : '';
    sorted.forEach((s, i) => grid.appendChild(cardEl(s, i)));
    buildStats();
  }

  /* ---------- profile modal ---------- */
  const overlay = document.getElementById('profileOverlay');
  const profileBody = document.getElementById('profileBody');
  let currentProfileId = null;

  function openProfile(id, opts) {
    currentProfileId = id;
    renderProfile(id);
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    if (opts && opts.scrollToSidewallets) {
      setTimeout(() => {
        const el = document.getElementById('sidewalletSection');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.classList.add('flash');
          setTimeout(() => el.classList.remove('flash'), 1200);
        }
      }, 30);
    }
  }
  function closeProfile() {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
    render();
  }
  document.getElementById('closeProfile').addEventListener('click', closeProfile);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeProfile(); });
  document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('open')) {
      if (e.key === 'Escape') closeProfile();
      if (e.key === 'ArrowRight') stepProfile(1);
      if (e.key === 'ArrowLeft') stepProfile(-1);
    }
  });
  document.getElementById('prevBtn').addEventListener('click', () => stepProfile(-1));
  document.getElementById('nextBtn').addEventListener('click', () => stepProfile(1));
  function stepProfile(dir) {
    if (!currentList.length) return;
    let i = currentList.indexOf(currentProfileId);
    if (i === -1) i = 0;
    i = (i + dir + currentList.length) % currentList.length;
    openProfile(currentList[i]);
  }

  function section(label) {
    const s = document.createElement('div'); s.className = 'p-section';
    const l = document.createElement('span'); l.className = 'p-label'; l.textContent = label;
    s.appendChild(l);
    return s;
  }

  function renderProfile(id) {
    const state = getState(id);
    const tier = tierFor(state.relevance);
    profileBody.innerHTML = '';
    profileBody.style.setProperty('--tier-color', `var(${tier.v})`);

    const head = document.createElement('div'); head.className = 'p-head';
    const avWrap = document.createElement('div'); avWrap.className = 'p-avatar-wrap';
    const avImg = document.createElement('img'); avImg.className = 'p-avatar' + (state.avatar ? ' avatar-custom' : ''); avImg.src = avatarSrc(state); avImg.alt = '';
    const upTab = document.createElement('div'); upTab.className = 'upload-tab'; upTab.textContent = 'PFP';
    upTab.addEventListener('click', () => triggerAvatarUpload(id));
    avWrap.append(avImg, upTab);
    if (state.avatar) {
      const rmTab = document.createElement('div'); rmTab.className = 'remove-tab'; rmTab.textContent = '✕'; rmTab.title = 'Remover foto';
      rmTab.addEventListener('click', () => {
        saveOverride(id, { avatar: null });
        playRemove();
        toast('Foto removida');
        renderProfile(id);
        render();
      });
      avWrap.appendChild(rmTab);
    }
    const titleBox = document.createElement('div'); titleBox.className = 'p-title';
    const nameRow = document.createElement('div'); nameRow.className = 'name-row';
    const nameInput = document.createElement('input'); nameInput.className = 'p-name-input'; nameInput.value = state.name;
    nameInput.addEventListener('change', () => {
      const v = nameInput.value.trim();
      if (!v) { nameInput.value = state.name; return; }
      saveOverride(id, { name: v });
      playCoin();
      toast('Nome atualizado');
    });
    nameRow.appendChild(nameInput);
    const tierRow = document.createElement('div'); tierRow.className = 'p-tier-row';
    const pill = document.createElement('span'); pill.className = 'tier-pill'; pill.style.setProperty('--tier-color', `var(${tier.v})`); pill.textContent = tier.label;
    const wc = document.createElement('span'); wc.className = 'type-tag'; wc.textContent = state.walletCount + ' carteira' + (state.walletCount !== 1 ? 's' : '');
    tierRow.append(pill, wc);
    if (state.isCustom) { const cb = document.createElement('span'); cb.className = 'type-tag'; cb.textContent = 'criado manualmente'; tierRow.appendChild(cb); }
    titleBox.append(nameRow, tierRow);
    head.append(avWrap, titleBox);

    const twitterSec = section('Twitter / X');
    const trow = document.createElement('div'); trow.className = 'twitter-row';
    const tin = document.createElement('input'); tin.className = 'p-input'; tin.placeholder = '@handle (preencha se souber — nada aqui é verificado)'; tin.value = state.twitter;
    const xlink = document.createElement('a'); xlink.className = 'x-link'; xlink.target = '_blank'; xlink.rel = 'noopener noreferrer'; xlink.textContent = 'abrir perfil';
    function syncX() {
      const h = tin.value.trim().replace(/^@/, '');
      if (h) { xlink.href = 'https://x.com/' + encodeURIComponent(h); xlink.classList.add('live'); }
      else { xlink.removeAttribute('href'); xlink.classList.remove('live'); }
    }
    syncX();
    tin.addEventListener('input', syncX);
    tin.addEventListener('change', () => { saveOverride(id, { twitter: tin.value.trim().replace(/^@/, '') }); playCoin(); toast('Twitter salvo'); });
    trow.append(tin, xlink);
    twitterSec.appendChild(trow);

    const relSec = section('Relevância');
    const relBox = document.createElement('div'); relBox.className = 'relevance-box';
    const num = document.createElement('div'); num.className = 'relevance-num'; num.textContent = state.relevance; num.style.setProperty('--tier-color', `var(${tier.v})`);
    const sliderWrap = document.createElement('div'); sliderWrap.className = 'relevance-slider';
    const slider = document.createElement('input'); slider.type = 'range'; slider.min = 0; slider.max = 100; slider.value = state.relevance;
    slider.style.setProperty('--tier-color', `var(${tier.v})`);
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      num.textContent = v;
      const t = tierFor(v);
      num.style.setProperty('--tier-color', `var(${t.v})`);
      slider.style.setProperty('--tier-color', `var(${t.v})`);
      pill.textContent = t.label; pill.style.setProperty('--tier-color', `var(${t.v})`);
    });
    slider.addEventListener('change', () => { saveOverride(id, { relevance: parseInt(slider.value, 10) }); playCoin(); toast('Relevância salva'); });
    sliderWrap.appendChild(slider);
    relBox.append(num, sliderWrap);
    relSec.appendChild(relBox);
    const seedNote = document.createElement('div'); seedNote.className = 'seed-note';
    seedNote.textContent = state.isCustom
      ? 'KOL criado manualmente — não tem sugestão automática de relevância, defina como preferir.'
      : `Sugestão automática: ${state.seedRelevance}/100 (a partir de carteiras rastreadas${state.squads.length ? ' + squad ' + state.squads.join(', ') : ''}). Ajuste livremente.`;
    relSec.appendChild(seedNote);

    const typeSec = section('Tipo de trader');
    const tgrid = document.createElement('div'); tgrid.className = 'type-grid';
    TYPES.forEach((t) => {
      const b = document.createElement('span'); b.className = 'type-pick' + (state.types.includes(t.id) ? ' on' : '');
      b.style.setProperty('--pick-color', `hsl(${t.hue} 55% 46%)`);
      b.textContent = t.label;
      b.addEventListener('click', () => {
        const set = new Set(state.types);
        if (set.has(t.id)) set.delete(t.id); else set.add(t.id);
        state.types = Array.from(set);
        saveOverride(id, { types: state.types });
        b.classList.toggle('on');
        playCoin();
      });
      tgrid.appendChild(b);
    });
    typeSec.appendChild(tgrid);

    const fnfSec = section('Grupos / FnFs');
    const fgrid = document.createElement('div'); fgrid.className = 'type-grid';
    const allGroups = loadGroups();
    if (!allGroups.length) {
      const hint = document.createElement('div'); hint.style.cssText = 'font-size:13px; color:var(--ink-faint); margin-bottom:10px;';
      hint.textContent = 'Nenhum grupo/FnF criado ainda.';
      fnfSec.appendChild(hint);
    } else {
      allGroups.forEach((g) => {
        const b = document.createElement('span'); b.className = 'type-pick' + (state.fnfGroups.includes(g.id) ? ' on' : '');
        const hue = groupHue(g.id);
        b.style.setProperty('--pick-color', `hsl(${hue} 55% 46%)`);
        b.textContent = g.name;
        b.addEventListener('click', () => {
          const set = new Set(state.fnfGroups);
          if (set.has(g.id)) set.delete(g.id); else set.add(g.id);
          state.fnfGroups = Array.from(set);
          saveOverride(id, { fnfGroups: state.fnfGroups });
          b.classList.toggle('on');
          playCoin();
        });
        fgrid.appendChild(b);
      });
      fnfSec.appendChild(fgrid);
    }
    const fnfQuick = document.createElement('div'); fnfQuick.className = 'add-wallet-row'; fnfQuick.style.marginTop = '10px'; fnfQuick.style.borderRadius = 'var(--r-sm)';
    const fnfIn = document.createElement('input'); fnfIn.placeholder = 'novo grupo/FnF (ex: FnF do Cupsey)';
    const fnfBtn = document.createElement('button'); fnfBtn.className = 'btn btn-ghost'; fnfBtn.textContent = 'Criar e marcar';
    fnfBtn.addEventListener('click', () => {
      const gname = fnfIn.value.trim();
      if (!gname) { toast('Dê um nome pro grupo antes de criar.'); return; }
      const g = createGroup(gname);
      const set = new Set(state.fnfGroups); set.add(g.id);
      saveOverride(id, { fnfGroups: Array.from(set) });
      playSuccess();
      toast('Grupo criado e marcado');
      fnfIn.value = '';
      refreshFnfChips();
      renderProfile(id);
    });
    fnfQuick.append(fnfIn, fnfBtn);
    fnfSec.appendChild(fnfQuick);

    let squadSec = null;
    if (state.squads.length) {
      squadSec = section('Squad de origem');
      const sl = document.createElement('div'); sl.className = 'squad-list';
      state.squads.forEach((s) => { const sp = document.createElement('span'); sp.className = 'squad-pill'; sp.textContent = s; sl.appendChild(sp); });
      squadSec.appendChild(sl);
    }

    const walSec = section('Carteiras (' + state.wallets.length + ')');
    const ledger = document.createElement('div'); ledger.className = 'wallet-ledger';
    if (!state.wallets.length) {
      const e = document.createElement('div'); e.className = 'wallet-empty'; e.textContent = 'Nenhuma carteira ainda — adicione uma abaixo.';
      ledger.appendChild(e);
    }
    state.wallets.forEach((w) => {
      const row = document.createElement('div'); row.className = 'wrow';
      const selKey = id + '|' + w.address;
      if (selectedWallets.has(selKey)) row.classList.add('selected');
      const chk = document.createElement('span'); chk.className = 'wcheck'; chk.textContent = '✓';
      const wn = document.createElement('span'); wn.className = 'wname'; wn.textContent = w.name; wn.title = w.name;
      const wa = document.createElement('span'); wa.className = 'waddr'; wa.textContent = w.address; wa.title = w.address;
      const btn = document.createElement('button'); btn.className = 'wcopy'; btn.textContent = 'copiar';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const done = () => { btn.textContent = 'copiado'; btn.classList.add('copied'); setTimeout(() => { btn.textContent = 'copiar'; btn.classList.remove('copied'); }, 1100); };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(w.address).then(done).catch(done); else done();
      });
      const del = document.createElement('button'); del.className = 'wremove'; del.textContent = 'remover';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeWallet(id, w.address, w.name); });
      row.title = 'Clique na linha para selecionar';
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        toggleWalletSelect(id, w, row);
      });
      row.append(chk, wn, wa, btn, del);
      ledger.appendChild(row);
    });
    const addRow = document.createElement('div'); addRow.className = 'add-wallet-row';
    const anIn = document.createElement('input'); anIn.placeholder = 'apelido (ex: Principal)';
    const aaIn = document.createElement('input'); aaIn.placeholder = 'endereço da carteira';
    const aBtn = document.createElement('button'); aBtn.className = 'btn btn-ghost'; aBtn.textContent = 'Adicionar carteira';
    aBtn.addEventListener('click', () => {
      const addr = aaIn.value.trim();
      if (!addr) { toast('Cole um endereço antes de adicionar.'); return; }
      if (state.wallets.some((w) => w.address === addr)) { toast('Essa carteira já está nesse KOL.'); return; }
      addWallet(id, anIn.value.trim() || 'Carteira', addr);
      anIn.value = ''; aaIn.value = '';
    });
    addRow.append(anIn, aaIn, aBtn);
    ledger.appendChild(addRow);
    walSec.appendChild(ledger);

    const sideSec = section('Sidewallets / Copytraders');
    sideSec.id = 'sidewalletSection';
    sideSec.appendChild(buildSidewalletBlock(id));

    const notesSec = section('Notas');
    const ta = document.createElement('textarea'); ta.className = 'p-textarea'; ta.rows = 3; ta.placeholder = 'ex: costuma comprar cedo em runners de baixo mcap, call no X arrasta volume real…';
    ta.value = state.notes;
    ta.addEventListener('change', () => { saveOverride(id, { notes: ta.value }); playCoin(); toast('Notas salvas'); });
    notesSec.appendChild(ta);

    const dangerSec = section('Remover');
    const dz = document.createElement('div'); dz.className = 'danger-zone';
    const dzTxt = document.createElement('span'); dzTxt.textContent = 'Remove este KOL do índice (dá pra desfazer logo em seguida).';
    const dzBtn = document.createElement('button'); dzBtn.className = 'btn btn-danger'; dzBtn.textContent = 'Remover KOL';
    dzBtn.addEventListener('click', async () => {
      const ok = await openConfirm({
        title: 'Remover KOL',
        message: `Tem certeza que quer remover "${state.name}" do índice? Dá pra desfazer pelo toast logo em seguida, mas depois de recarregar a página não tem mais volta.`,
        confirmLabel: 'Remover',
      });
      if (!ok) return;
      removeKol(id);
      closeProfile();
    });
    dz.append(dzTxt, dzBtn);
    dangerSec.appendChild(dz);

    profileBody.append(head, twitterSec, relSec, typeSec, fnfSec);
    if (squadSec) profileBody.append(squadSec);
    profileBody.append(walSec, sideSec, notesSec, dangerSec);
  }

  /* ---------- sidewallet/copytrader scan block ---------- */
  function buildSidewalletBlock(id) {
    const wrap = document.createElement('div');
    const scan = SCANS.scans && SCANS.scans[id];

    const headerRow = document.createElement('div'); headerRow.className = 'scan-header-row';
    const info = document.createElement('span'); info.className = 'scan-meta';
    info.textContent = scan
      ? 'Última varredura: ' + new Date(scan.scannedAt).toLocaleString('pt-BR')
      : 'Ainda não escaneado.';
    const btn = document.createElement('button'); btn.className = 'btn btn-ghost'; btn.type = 'button';
    btn.textContent = scan ? 'Rodar nova varredura' : 'Rodar varredura';
    headerRow.append(info, btn);
    wrap.appendChild(headerRow);

    const help = document.createElement('p'); help.className = 'scan-help';
    help.textContent = 'Cruza dados reais de trading on-chain (via GMGN) nos últimos 5 tokens da carteira pública deste KOL. Só confirma sidewallet com evidência forte: link direto (transferência do token ou mesma origem de financiamento) ou um padrão comportamental repetido em 2+ tokens (compra antes + venda pouco antes da carteira pública). Compra antecipada isolada não conta — é comportamento normal de sniper. Carteiras já identificadas como de outro trader conhecido levam um aviso. Precisa do servidor local rodando (node scripts/serve.js) — leva ~15-20s.';
    wrap.appendChild(help);

    const resultBox = document.createElement('div'); resultBox.className = 'scan-result';
    wrap.appendChild(resultBox);

    function dismissSidewallet(address) {
      const o = loadOverride(id);
      const list = (o.dismissedSidewallets || []).concat([address]);
      saveOverride(id, { dismissedSidewallets: list });
      playRemove();
      toast('Sidewallet removida da lista', {
        actionLabel: 'desfazer',
        onAction: () => {
          const o2 = loadOverride(id);
          saveOverride(id, { dismissedSidewallets: (o2.dismissedSidewallets || []).filter((a) => a !== address) });
          renderProfile(id);
        },
      });
      renderProfile(id);
    }

    function renderResult() {
      resultBox.innerHTML = '';
      if (!scan) return;
      if (scan.status === 'error') {
        const box = document.createElement('div'); box.className = 'scan-summary scan-summary-error';
        box.textContent = scan.summary;
        resultBox.appendChild(box);
        return;
      }
      const box = document.createElement('div'); box.className = 'scan-summary';
      box.textContent = scan.summary;
      resultBox.appendChild(box);

      const dismissed = new Set(loadOverride(id).dismissedSidewallets || []);
      const visible = (scan.flagged || []).filter((f) => !dismissed.has(f.address));

      if (visible.length) {
        const list = document.createElement('div'); list.className = 'scan-flagged-list';
        visible.forEach((f) => {
          const row = document.createElement('div'); row.className = 'scan-flagged-row';
          const top = document.createElement('div'); top.className = 'scan-flagged-top';

          const roleTag = document.createElement('span');
          roleTag.className = 'role-tag role-' + f.role;
          roleTag.textContent = f.role === 'sidewallet' ? 'Sidewallet' : 'Copytrader';
          top.appendChild(roleTag);

          if (f.role === 'sidewallet') {
            const badge = document.createElement('span'); badge.className = 'confidence-badge confidence-' + f.confidence;
            badge.textContent = f.confidence === 'high' ? 'Link direto' : 'Padrão repetido';
            top.appendChild(badge);
          }
          if (f.recognizedElsewhere) {
            const warn = document.createElement('span'); warn.className = 'recognized-warn';
            warn.textContent = '⚠ trader conhecido' + (f.recognizedAs ? ': ' + f.recognizedAs : '');
            top.appendChild(warn);
          }

          const nameSpan = document.createElement('span'); nameSpan.className = 'scan-flagged-name';
          nameSpan.textContent = f.name ? f.name + (f.ownerKolName && f.ownerKolName !== f.name ? ' (' + f.ownerKolName + ')' : '') : 'carteira desconhecida';
          top.appendChild(nameSpan);

          if (f.ownerKolId) {
            const openBtn = document.createElement('button'); openBtn.className = 'scan-open-kol'; openBtn.type = 'button'; openBtn.textContent = 'abrir perfil →';
            openBtn.addEventListener('click', () => openProfile(f.ownerKolId));
            top.appendChild(openBtn);
          }
          const rmBtn = document.createElement('button'); rmBtn.className = 'scan-dismiss'; rmBtn.type = 'button'; rmBtn.textContent = 'remover';
          rmBtn.title = 'Remover essa sidewallet identificada';
          rmBtn.addEventListener('click', () => dismissSidewallet(f.address));
          top.appendChild(rmBtn);

          const addr = document.createElement('div'); addr.className = 'scan-flagged-addr'; addr.textContent = f.address;
          const reason = document.createElement('div'); reason.className = 'scan-flagged-reason'; reason.textContent = f.reason;
          row.append(top, addr, reason);
          list.appendChild(row);
        });
        resultBox.appendChild(list);
      }
    }
    renderResult();

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const originalLabel = btn.textContent;
      btn.textContent = 'Escaneando…';
      toast('Varredura iniciada — cruzando dados on-chain reais, pode levar um tempo.');
      try {
        const result = await runSidewalletScan(id);
        playSuccess();
        toast(result.status === 'error' ? 'Varredura falhou — veja o motivo abaixo.' : 'Varredura concluída.');
        renderProfile(id);
        render();
      } catch (e) {
        playRemove();
        toast('Não consegui rodar a varredura: ' + (e.message || e) + ' — rode "node scripts/serve.js" num terminal e tente de novo.');
      } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
      }
    });

    return wrap;
  }

  /* ---------- wallet add/remove ---------- */
  function addWallet(id, name, address) {
    const o = loadOverride(id);
    const removed = new Set(o.walletsRemoved || []);
    if (removed.has(address)) {
      removed.delete(address);
      saveOverride(id, { walletsRemoved: Array.from(removed) });
    } else {
      const added = (o.walletsAdded || []).concat([{ name, address }]);
      saveOverride(id, { walletsAdded: added });
    }
    playCoin();
    toast('Carteira adicionada');
    renderProfile(id);
    render();
  }
  function removeWallet(id, address, name) {
    const o = loadOverride(id);
    const added = o.walletsAdded || [];
    const idxAdded = added.findIndex((w) => w.address === address);
    if (idxAdded >= 0) {
      const next = added.slice(); next.splice(idxAdded, 1);
      saveOverride(id, { walletsAdded: next });
    } else {
      const removed = new Set(o.walletsRemoved || []); removed.add(address);
      saveOverride(id, { walletsRemoved: Array.from(removed) });
    }
    selectedWallets.delete(id + '|' + address);
    updateSelectionBar();
    playRemove();
    toast('Carteira removida', { actionLabel: 'desfazer', onAction: () => { addWallet(id, name, address); } });
    renderProfile(id);
    render();
  }

  /* ---------- KOL add/remove ---------- */
  function removeKol(id) {
    const state = getState(id);
    state.wallets.forEach((w) => selectedWallets.delete(id + '|' + w.address));
    updateSelectionBar();
    playRemove();
    if (state.isCustom) {
      const ids = loadCustomIds().filter((x) => x !== id);
      saveCustomIds(ids);
      localStorage.removeItem(LS_PREFIX + id);
      toast('KOL removido', {
        actionLabel: 'desfazer', onAction: () => {
          saveCustomIds(loadCustomIds().concat([id]));
          saveOverride(id, { name: state.name, walletsAdded: state.wallets, relevance: state.relevance, types: state.types, twitter: state.twitter, notes: state.notes, avatar: state.avatar, deleted: false });
          render();
        }
      });
    } else {
      saveOverride(id, { deleted: true });
      toast('KOL removido do índice', { actionLabel: 'desfazer', onAction: () => { saveOverride(id, { deleted: false }); render(); } });
    }
    render();
  }

  const addKolOverlay = document.getElementById('addKolOverlay');
  document.getElementById('addKolBtn').addEventListener('click', () => {
    document.getElementById('newKolName').value = '';
    document.getElementById('newKolWalletName').value = '';
    document.getElementById('newKolWalletAddr').value = '';
    addKolOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('newKolName').focus(), 30);
  });
  function closeAddKol() { addKolOverlay.classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('closeAddKol').addEventListener('click', closeAddKol);
  document.getElementById('cancelAddKol').addEventListener('click', closeAddKol);
  addKolOverlay.addEventListener('click', (e) => { if (e.target === addKolOverlay) closeAddKol(); });
  document.getElementById('confirmAddKol').addEventListener('click', () => {
    const name = document.getElementById('newKolName').value.trim();
    if (!name) { toast('Dê um nome pro KOL antes de criar.'); return; }
    const wName = document.getElementById('newKolWalletName').value.trim() || 'Principal';
    const wAddr = document.getElementById('newKolWalletAddr').value.trim();
    const id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const walletsAdded = wAddr ? [{ name: wName, address: wAddr }] : [];
    saveOverride(id, { name, walletsAdded, relevance: 20, types: [], twitter: '', notes: '' });
    saveCustomIds(loadCustomIds().concat([id]));
    closeAddKol();
    playSuccess();
    toast('KOL criado');
    render();
    openProfile(id);
  });

  /* ---------- groups / fnfs manager ---------- */
  const groupsOverlay = document.getElementById('groupsOverlay');
  function renderGroupsList() {
    const list = document.getElementById('groupsList');
    list.innerHTML = '';
    const groups = loadGroups();
    if (!groups.length) {
      const e = document.createElement('div'); e.className = 'groups-empty'; e.textContent = 'Nenhum grupo/FnF criado ainda.';
      list.appendChild(e);
      return;
    }
    groups.forEach((g) => {
      const item = document.createElement('div'); item.className = 'group-item';

      const row = document.createElement('div'); row.className = 'group-row';
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = `hsl(${groupHue(g.id)} 60% 55%)`;
      const input = document.createElement('input'); input.value = g.name;
      input.addEventListener('change', () => {
        const v = input.value.trim();
        if (!v) { input.value = g.name; return; }
        renameGroup(g.id, v);
        playCoin();
        toast('Grupo renomeado');
        refreshFnfChips();
        render();
      });
      const members = groupMembers(g.id);
      const count = document.createElement('span'); count.className = 'group-count'; count.textContent = members.length + ' kol' + (members.length !== 1 ? 's' : '');
      const del = document.createElement('button'); del.className = 'group-del'; del.textContent = 'apagar';
      del.addEventListener('click', () => {
        deleteGroup(g.id);
        playRemove();
        toast('Grupo apagado');
        refreshFnfChips();
        renderGroupsList();
        render();
        if (overlay.classList.contains('open') && currentProfileId) renderProfile(currentProfileId);
      });
      row.append(dot, input, count, del);
      item.appendChild(row);

      const memberList = document.createElement('div'); memberList.className = 'group-members';
      if (!members.length) {
        const e = document.createElement('div'); e.className = 'group-members-empty';
        e.textContent = 'Nenhum KOL marcado nesse grupo ainda — abra um perfil e marque em "Grupos / FnFs".';
        memberList.appendChild(e);
      } else {
        members.forEach((m) => {
          const tier = tierFor(m.relevance);
          const row2 = document.createElement('button'); row2.type = 'button'; row2.className = 'group-member';
          const av = document.createElement('img'); av.className = 'group-member-avatar'; av.src = avatarSrc(m); av.alt = '';
          const name = document.createElement('span'); name.className = 'group-member-name'; name.textContent = m.name;
          const pill = document.createElement('span'); pill.className = 'tier-pill'; pill.style.setProperty('--tier-color', `var(${tier.v})`); pill.textContent = tier.label;
          row2.append(av, name, pill);
          row2.addEventListener('click', () => {
            closeGroups();
            openProfile(m.id);
          });
          memberList.appendChild(row2);
        });
      }
      item.appendChild(memberList);

      list.appendChild(item);
    });
  }
  function openGroups() {
    renderGroupsList();
    document.getElementById('newGroupName').value = '';
    groupsOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  document.getElementById('manageGroupsBtn').addEventListener('click', openGroups);
  const navGroups = document.getElementById('navGroups');
  if (navGroups) navGroups.addEventListener('click', (e) => { e.preventDefault(); openGroups(); });
  function closeGroups() { groupsOverlay.classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('closeGroups').addEventListener('click', closeGroups);
  groupsOverlay.addEventListener('click', (e) => { if (e.target === groupsOverlay) closeGroups(); });
  document.getElementById('createGroupBtn').addEventListener('click', () => {
    const input = document.getElementById('newGroupName');
    const name = input.value.trim();
    if (!name) { toast('Dê um nome pro grupo antes de criar.'); return; }
    createGroup(name);
    input.value = '';
    playSuccess();
    toast('Grupo criado');
    refreshFnfChips();
    renderGroupsList();
  });
  document.getElementById('newGroupName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('createGroupBtn').click(); }
  });

  /* ---------- avatar upload ---------- */
  const avatarFileInput = document.getElementById('avatarFile');
  let uploadTargetId = null;
  function triggerAvatarUpload(id) { uploadTargetId = id; avatarFileInput.click(); }
  avatarFileInput.addEventListener('change', () => {
    const file = avatarFileInput.files[0];
    if (!file || !uploadTargetId) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const size = 200;
        const c = document.createElement('canvas'); c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        const s = Math.max(size / img.width, size / img.height);
        const w = img.width * s, h = img.height * s;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        const dataUrl = c.toDataURL('image/jpeg', 0.85);
        const ok = saveOverride(uploadTargetId, { avatar: dataUrl });
        if (ok) { playCoin(); toast('Foto atualizada'); renderProfile(uploadTargetId); render(); }
        avatarFileInput.value = '';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  /* ---------- export / import / reset ---------- */
  document.getElementById('legendBtn').addEventListener('click', () => {
    document.getElementById('legendPop').classList.toggle('open');
  });

  function collectAllOverrides() {
    const out = {};
    allIds().forEach((id) => {
      const o = loadOverride(id);
      if (Object.keys(o).length) out[id] = o;
    });
    return { overrides: out, customIds: loadCustomIds(), groups: loadGroups() };
  }

  /* ---------- auto-backup on close ---------- */
  function saveAutoBackup() {
    try {
      const data = collectAllOverrides();
      const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), auto: true, overrides: data.overrides, customIds: data.customIds, groups: data.groups });
      localStorage.setItem('wr:autobackup:latest', payload);
      localStorage.setItem('wr:autobackup:at', String(Date.now()));
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/backup', new Blob([payload], { type: 'application/json' }));
      }
    } catch (e) { /* best-effort — never block page close on a backup failure */ }
  }
  window.addEventListener('pagehide', saveAutoBackup);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveAutoBackup(); });

  document.getElementById('exportBtn').addEventListener('click', () => {
    const data = collectAllOverrides();
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), overrides: data.overrides, customIds: data.customIds, groups: data.groups }, null, 2);
    downloadFile('kol-index-backup.json', payload, 'application/json');
    playSuccess();
    toast('Backup salvo');
  });

  document.getElementById('importBtn').addEventListener('click', () => { document.getElementById('importFile').click(); });
  document.getElementById('importFile').addEventListener('change', () => {
    const file = document.getElementById('importFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const overrides = parsed.overrides || {};
        Object.keys(overrides).forEach((id) => localStorage.setItem(LS_PREFIX + id, JSON.stringify(overrides[id])));
        if (Array.isArray(parsed.customIds)) {
          const merged = Array.from(new Set(loadCustomIds().concat(parsed.customIds)));
          saveCustomIds(merged);
        }
        if (Array.isArray(parsed.groups)) {
          const existing = loadGroups();
          const byId = new Map(existing.map((g) => [g.id, g]));
          parsed.groups.forEach((g) => { if (g && g.id) byId.set(g.id, g); });
          saveGroups(Array.from(byId.values()));
        }
        playSuccess();
        toast('Backup importado (' + Object.keys(overrides).length + ' perfis)');
        refreshSquadChips();
        refreshFnfChips();
        render();
      } catch (err) { toast('Arquivo inválido.'); }
      document.getElementById('importFile').value = '';
    };
    reader.readAsText(file);
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (!confirm('Isso apaga todas as edições salvas neste navegador (twitter, tipo, relevância, notas, fotos, carteiras, KOLs criados e grupos/FnFs). Exporte um backup antes se quiser manter. Continuar?')) return;
    STATIC_PROFILES.forEach((p) => localStorage.removeItem(LS_PREFIX + p.id));
    loadCustomIds().forEach((id) => localStorage.removeItem(LS_PREFIX + id));
    saveCustomIds([]);
    saveGroups([]);
    activeFnfFilter.clear();
    selectedWallets.clear();
    updateSelectionBar();
    refreshFnfChips();
    playRemove();
    toast('Edições limpas');
    render();
  });

  /* ---------- search / sort ---------- */
  document.getElementById('search').addEventListener('input', (e) => { searchQ = e.target.value.trim().toLowerCase(); render(); });
  document.getElementById('sortSel').addEventListener('change', (e) => { sortMode = e.target.value; render(); });

  /* ---------- init ---------- */
  buildFilterChips();
  render();
  loadScans().then(() => {
    render();
    if (overlay.classList.contains('open') && currentProfileId) renderProfile(currentProfileId);
  });
})();
