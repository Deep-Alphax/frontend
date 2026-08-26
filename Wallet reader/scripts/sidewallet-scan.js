// Sidewallet / copytrader detection for a single KOL, using real on-chain trade
// data pulled live via `gmgn-cli` (already installed + authenticated on this
// machine). Scoped to the wallets already tracked in wallets.txt/kol-profiles —
// we're not searching all of Solana, only checking whether any OTHER wallet
// already in this index behaves like a side wallet of the given KOL's public
// wallet (the first wallet listed on the profile).
//
// Two evidence tiers, deliberately conservative — a wrong "sidewallet" call is
// worse than a missed one, so weak single-signal coincidences are dropped
// entirely rather than surfaced as "low confidence":
//
//   HIGH  (direct on-chain link — "estarem linkadas"):
//     - transfer:        candidate sent one of the analyzed tokens straight to
//                         the public wallet.
//     - shared_funding:  candidate's wallet was funded (first SOL transfer in)
//                         from the same source as the public wallet — same
//                         operator bankrolling both.
//
//   MEDIUM (behavioral fingerprint when NOT directly linked — the disguise
//   pattern: buy before the public wallet, then sell shortly BEFORE it does,
//   so the operator is already out before the public wallet's sell would spook
//   copytraders. A single occurrence is normal sniping noise, not evidence —
//   this only counts once it repeats across >=2 of the last 5 tokens):
//     - early_buy_late_sell, confirmed on 2+ distinct tokens.
//
// Wallets that GMGN itself already identifies as belonging to a different,
// named/recognized trader (own display name, Twitter handle, or a
// renowned/smart_degen tag) are excluded from the flagged list unless they
// also show HIGH-tier direct-link evidence — an independent known trader
// sniping the same fresh pump.fun launch is not a side wallet.
//
// Run standalone: node scripts/sidewallet-scan.js <kolId>
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const PROFILES = require(path.join(root, 'assets', 'data', 'kol-profiles.js'));
const SCANS_PATH = path.join(root, 'assets', 'data', 'sidewallet-scans.json');

const MIN_TRANSFER_USD = 3; // filters out dust/airdrop-spam transfers
const MAX_TOKENS = 5;
const CALL_SPACING_MS = 400; // pace calls so we stay under GMGN's leaky-bucket limit
const COPYTRADER_WINDOW_SECONDS = 24 * 3600; // how long after the public buy still counts as "copytrading"
const SELL_BEFORE_WINDOW_SECONDS = 15 * 60; // "segundos antes" -> generously, within 15 min before
const MIN_TOKENS_FOR_PATTERN = 2; // behavioral pattern must repeat to count as evidence

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin — short, local, single-user tool */ }
}

function gmgnRaw(args) {
  const out = execFileSync('gmgn-cli', args.concat(['--raw']), {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 50,
    timeout: 30000,
    shell: true, // gmgn-cli is an npm .cmd shim on Windows — needs a shell to resolve
  });
  sleepSync(CALL_SPACING_MS); // stay well under the rate limit instead of tripping bans
  const lines = out.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('{') || line.startsWith('[')) {
      try { return JSON.parse(line); } catch (e) { /* keep looking */ }
    }
  }
  throw new Error('could not parse gmgn-cli output: ' + out.slice(0, 300));
}

function buildUniverse() {
  const map = new Map();
  PROFILES.forEach((p) => {
    p.wallets.forEach((w) => {
      map.set(w.address, { kolId: p.id, kolName: p.name, walletName: w.name });
    });
  });
  return map;
}

function isRecognizedElsewhere(trader) {
  if (!trader) return false;
  if (trader.name) return true;
  if (trader.twitter_username) return true;
  const tags = trader.tags || [];
  return tags.includes('renowned') || tags.includes('smart_degen');
}

function persist(result) {
  const all = fs.existsSync(SCANS_PATH) ? JSON.parse(fs.readFileSync(SCANS_PATH, 'utf8')) : { version: 1, scans: {} };
  all.scans[result.kolId] = result;
  fs.writeFileSync(SCANS_PATH, JSON.stringify(all, null, 2));
  return result;
}

function scanKol(kolId) {
  const profile = PROFILES.find((p) => p.id === kolId);
  if (!profile) throw new Error('KOL not found: ' + kolId);
  if (!profile.wallets.length) throw new Error('KOL has no wallets: ' + kolId);

  const universe = buildUniverse();
  const ownAddrs = new Set(profile.wallets.map((w) => w.address));
  const publicWallet = profile.wallets[0];
  let apiCalls = 0;

  function fail(message) {
    return persist({
      kolId, kolName: profile.name, scannedAt: Date.now(), status: 'error',
      publicWallet: publicWallet.address, tokensAnalyzed: 0, apiCalls, flagged: [],
      summary: `Varredura falhou: ${message}. Provável rate limit da GMGN — tente de novo em alguns minutos.`,
    });
  }

  // ---- 1. last 5 distinct tokens the public wallet bought ----
  let buyResp;
  try {
    buyResp = gmgnRaw(['portfolio', 'activity', '--chain', 'sol', '--wallet', publicWallet.address, '--type', 'buy', '--limit', '30']);
    apiCalls++;
  } catch (e) { return fail(e.message); }

  const tokens = []; // [{address, symbol, kolBuyAt}] most recent first, deduped
  (buyResp.activities || []).forEach((a) => {
    if (!a.token || !a.token.address) return;
    if (tokens.some((t) => t.address === a.token.address)) return;
    if (tokens.length >= MAX_TOKENS) return;
    tokens.push({ address: a.token.address, symbol: a.token.symbol, kolBuyAt: a.timestamp, kolSellAt: null });
  });

  if (!tokens.length) {
    return persist({
      kolId, kolName: profile.name, scannedAt: Date.now(), status: 'complete',
      publicWallet: publicWallet.address, tokensAnalyzed: 0, apiCalls, flagged: [],
      summary: `A carteira pública de ${profile.name} não tem compras recentes registradas na GMGN — nada pra analisar.`,
    });
  }

  // ---- 2. the public wallet's own sells on those tokens (earliest sell = start of exit) ----
  try {
    const sellResp = gmgnRaw(['portfolio', 'activity', '--chain', 'sol', '--wallet', publicWallet.address, '--type', 'sell', '--limit', '50']);
    apiCalls++;
    (sellResp.activities || []).forEach((a) => {
      if (!a.token) return;
      const tok = tokens.find((t) => t.address === a.token.address);
      if (!tok) return;
      if (tok.kolSellAt === null || a.timestamp < tok.kolSellAt) tok.kolSellAt = a.timestamp;
    });
  } catch (e) { /* no sell data — sell-timing evidence just won't be available */ }

  const findings = new Map(); // address -> { address, name, ownerKolId, ownerKolName, signals:Set, evidence:[], recognizedElsewhere, recognizedAs }
  function touch(address, trader) {
    if (ownAddrs.has(address)) return null;
    const known = universe.get(address);
    if (!known) return null; // only care about wallets already tracked in this index
    if (!findings.has(address)) {
      findings.set(address, {
        address, name: known.walletName, ownerKolId: known.kolId, ownerKolName: known.kolName,
        signals: new Set(), evidence: [],
        recognizedElsewhere: isRecognizedElsewhere(trader),
        recognizedAs: trader ? (trader.name || trader.twitter_username || null) : null,
      });
    } else if (trader && isRecognizedElsewhere(trader)) {
      findings.get(address).recognizedElsewhere = true;
      findings.get(address).recognizedAs = findings.get(address).recognizedAs || trader.name || trader.twitter_username || null;
    }
    return findings.get(address);
  }

  // ---- 3. incoming transfers of those tokens, from a tracked wallet (Category A) ----
  let publicFundingSource = null;
  try {
    const transferResp = gmgnRaw(['portfolio', 'activity', '--chain', 'sol', '--wallet', publicWallet.address, '--type', 'transferIn', '--limit', '50']);
    apiCalls++;
    (transferResp.activities || []).forEach((a) => {
      const from = a.from_address;
      if (!from || !a.token) return;
      const tokenHit = tokens.find((t) => t.address === a.token.address);
      if (!tokenHit) return; // only tokens we're already analyzing
      const usd = parseFloat(a.cost_usd || 0);
      if (usd < MIN_TRANSFER_USD) return;
      const f = touch(from, null);
      if (!f) return;
      f.signals.add('transfer');
      f.evidence.push({ type: 'transfer', token: tokenHit.symbol, tokenAddress: tokenHit.address, transferUsd: usd, transferAt: a.timestamp, transferTx: a.tx_hash });
    });
  } catch (e) { /* transfer evidence unavailable for this run */ }

  // ---- 4. per-token trader lists: funding source + buy/sell timing (Category A + B) ----
  tokens.forEach((tok) => {
    let resp;
    try { resp = gmgnRaw(['token', 'traders', '--chain', 'sol', '--address', tok.address, '--limit', '100']); apiCalls++; }
    catch (e) { return; }
    (resp.list || []).forEach((t) => {
      if (!t.address) return;
      if (t.address === publicWallet.address) {
        if (t.native_transfer && t.native_transfer.address) publicFundingSource = t.native_transfer.address;
        return;
      }
      if (ownAddrs.has(t.address)) return;

      const startAt = t.start_holding_at;
      const endAt = t.end_holding_at;

      // shared funding source (Category A) — only meaningful once we know the public wallet's own source
      if (t.native_transfer && t.native_transfer.address && publicFundingSource && t.native_transfer.address === publicFundingSource) {
        const f = touch(t.address, t);
        if (f) {
          f.signals.add('shared_funding');
          f.evidence.push({ type: 'shared_funding', token: tok.symbol, tokenAddress: tok.address, fundingSource: publicFundingSource });
        }
      }

      // behavioral pattern (Category B): bought before AND fully exited shortly before the public wallet's sell
      if (typeof startAt === 'number' && startAt < tok.kolBuyAt && typeof endAt === 'number' && tok.kolSellAt !== null) {
        const sellGap = tok.kolSellAt - endAt; // positive = candidate sold before the public wallet
        if (sellGap >= 0 && sellGap <= SELL_BEFORE_WINDOW_SECONDS) {
          const f = touch(t.address, t);
          if (f) {
            f.signals.add('early_buy_late_sell');
            f.evidence.push({
              type: 'early_buy_late_sell', token: tok.symbol, tokenAddress: tok.address,
              candidateBuyAt: startAt, candidateSellAt: endAt, kolBuyAt: tok.kolBuyAt, kolSellAt: tok.kolSellAt,
              sellGapSeconds: sellGap,
            });
          }
        }
      }

      // copytrader signal (informational, not accusatory): bought clearly after the public wallet
      if (typeof startAt === 'number' && startAt > tok.kolBuyAt && startAt - tok.kolBuyAt <= COPYTRADER_WINDOW_SECONDS) {
        const f = touch(t.address, t);
        if (f) {
          f.signals.add('copytrade');
          f.evidence.push({ type: 'copytrade', token: tok.symbol, tokenAddress: tok.address, candidateBuyAt: startAt, kolBuyAt: tok.kolBuyAt, deltaSeconds: startAt - tok.kolBuyAt });
        }
      }
    });
  });

  // ---- 5. cross-reference everything and classify ----
  const flagged = [];
  findings.forEach((f) => {
    const hasTransfer = f.signals.has('transfer');
    const hasSharedFunding = f.signals.has('shared_funding');
    const patternTokens = new Set(f.evidence.filter((e) => e.type === 'early_buy_late_sell').map((e) => e.tokenAddress)).size;
    const hasDirectLink = hasTransfer || hasSharedFunding;
    const hasConfirmedPattern = patternTokens >= MIN_TOKENS_FOR_PATTERN;
    const onlyCopytrade = f.signals.size === 1 && f.signals.has('copytrade');

    if (onlyCopytrade) {
      flagged.push(buildEntry(f, 'copytrader', 'info'));
      return;
    }
    if (!hasDirectLink && !hasConfirmedPattern) return; // weak/unconfirmed single-token coincidence — drop it
    if (!hasDirectLink && hasConfirmedPattern && f.recognizedElsewhere) return; // named independent trader, timing-only — not enough

    const confidence = hasDirectLink ? 'high' : 'medium';
    flagged.push(buildEntry(f, 'sidewallet', confidence));
  });

  function buildEntry(f, role, confidence) {
    const parts = [];
    const transferHit = f.evidence.find((e) => e.type === 'transfer');
    const fundingHit = f.evidence.find((e) => e.type === 'shared_funding');
    const patternHits = f.evidence.filter((e) => e.type === 'early_buy_late_sell');
    const copytradeHit = f.evidence.find((e) => e.type === 'copytrade');

    if (transferHit) parts.push(`Recebeu ${transferHit.token} (~$${transferHit.transferUsd.toFixed(0)}) direto da carteira pública, ou mandou pra ela — link direto on-chain.`);
    if (fundingHit) parts.push(`Foi financiada pela MESMA origem de SOL que financiou a carteira pública — mesmo operador.`);
    if (patternHits.length) {
      const toks = patternHits.map((e) => e.token).join(', ');
      parts.push(`Comprou antes e vendeu ${Math.round(patternHits[0].sellGapSeconds / 60) || '<1'} min antes da carteira pública em ${patternHits.length} token${patternHits.length > 1 ? 's diferentes' : ''} (${toks}) — padrão repetido, não coincidência isolada.`);
    }
    if (role === 'copytrader' && copytradeHit) {
      parts.push(`Comprou ${copytradeHit.token} ${Math.max(1, Math.round(copytradeHit.deltaSeconds / 60))} min DEPOIS da carteira pública — copytrader normal, não sidewallet.`);
    }
    if (f.recognizedElsewhere && role === 'sidewallet') {
      parts.push(`Aviso: essa carteira já tem identidade própria reconhecida pela GMGN${f.recognizedAs ? ' (' + f.recognizedAs + ')' : ''} — considere que pode ser um trader independente, não uma sidewallet do KOL.`);
    }
    if (!parts.length) parts.push('Sinal insuficiente.');

    return {
      address: f.address, name: f.name, ownerKolId: f.ownerKolId, ownerKolName: f.ownerKolName,
      role, confidence, recognizedElsewhere: f.recognizedElsewhere, recognizedAs: f.recognizedAs,
      signals: Array.from(f.signals), reason: parts.join(' '), evidence: f.evidence,
    };
  }

  flagged.sort((a, b) => {
    const roleOrder = { sidewallet: 0, copytrader: 1 };
    const confOrder = { high: 0, medium: 1, info: 2 };
    return roleOrder[a.role] - roleOrder[b.role] || confOrder[a.confidence] - confOrder[b.confidence];
  });

  const sidewallets = flagged.filter((f) => f.role === 'sidewallet');
  const copytraders = flagged.filter((f) => f.role === 'copytrader');
  const linked = sidewallets.filter((f) => f.confidence === 'high').length;
  const summary = `Analisou os últimos ${tokens.length} tokens de ${profile.name} contra as outras ${universe.size - ownAddrs.size} carteiras do índice: ${sidewallets.length} ${sidewallets.length === 1 ? 'sidewallet confirmada' : 'sidewallets confirmadas'} (${linked} com link direto on-chain, ${sidewallets.length - linked} por padrão comportamental repetido) e ${copytraders.length} ${copytraders.length === 1 ? 'copytrader identificado' : 'copytraders identificados'}. Coincidências de compra isolada (sem confirmação) foram descartadas.`;

  return persist({
    kolId, kolName: profile.name, scannedAt: Date.now(), status: 'complete',
    publicWallet: publicWallet.address, tokensAnalyzed: tokens.length, apiCalls, flagged, summary,
  });
}

module.exports = { scanKol };

if (require.main === module) {
  const kolId = process.argv[2];
  if (!kolId) {
    console.error('Usage: node scripts/sidewallet-scan.js <kolId>');
    process.exit(1);
  }
  const t0 = Date.now();
  const result = scanKol(kolId);
  console.log(JSON.stringify(result, null, 2));
  console.error(`\n${result.apiCalls} chamadas gmgn-cli em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
