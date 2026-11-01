#!/usr/bin/env node
// Local, one-shot setup form for the .env in KESEF_HOME.
//
// Binds to 127.0.0.1 on a random port, serves ONE page, writes .env (mode 600),
// then shuts itself down. Nothing is sent anywhere: the only network listener is
// loopback, guarded by a per-run token, and the page has no external assets.
//
// Run: npm run setup — or the `setup` MCP tool, which spawns this script.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { envPath, loadEnv, monthsBack } from '../config.mjs';
import { FIELDS, PROVIDER_META, page } from './setup-page.mjs';

const ENV_PATH = envPath();
const TOKEN = randomBytes(24).toString('base64url');

// Keys this form owns; every other KEY=value line in .env is carried over verbatim
// (family-mode keys, CHROME_PATH, RELAY_URL, …) so a re-run never wipes them.
const OWNED = new Set([...Object.values(FIELDS).flatMap(fs => fs.map(f => f.key)), 'SCRAPE_MONTHS_BACK']);

// Which providers already hold real (non-placeholder) values. Booleans only —
// saved secrets are never sent back to the page.
function savedState(env) {
  const state = {};
  for (const [provider, fields] of Object.entries(FIELDS)) {
    state[provider] = {
      any: fields.some(f => env[f.key]),
      fields: Object.fromEntries(fields.map(f => [f.key, Boolean(env[f.key])])),
    };
  }
  return state;
}

function foreignLines() {
  if (!existsSync(ENV_PATH)) return [];
  return readFileSync(ENV_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(l => {
      const m = l.match(/^([A-Z0-9_]+)=/);
      return m && !OWNED.has(m[1]);
    });
}

// Unused providers are omitted entirely rather than left as empty keys.
function renderEnv(values, months) {
  const out = [
    '# kesef.ai — bank credentials. Written by the setup form (npm run setup).',
    '# Keep this file private: it never leaves this machine.',
    '# To disable a provider, delete its lines (a commented-out key is inactive too).',
    '',
  ];
  for (const [provider, fields] of Object.entries(FIELDS)) {
    const filled = fields.filter(f => values[f.key]);
    if (!filled.length) continue;
    out.push(`# ===== ${PROVIDER_META[provider].title} =====`);
    for (const f of filled) out.push(`${f.key}=${values[f.key]}`);
    out.push('');
  }
  out.push(`SCRAPE_MONTHS_BACK=${months}`, '');
  const foreign = foreignLines();
  if (foreign.length) out.push(...foreign, '');
  return out.join('\n');
}

function tokenOk(candidate) {
  const a = Buffer.from(String(candidate || ''));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function save(body) {
  const existing = loadEnv();
  const values = {};
  const kept = [];
  for (const [provider, fields] of Object.entries(FIELDS)) {
    if (!body.providers[provider]) continue;
    const missing = [];
    for (const f of fields) {
      // Blank input keeps whatever was already saved for that key.
      const next = (body.values[f.key] || '').trim() || existing[f.key] || '';
      if (!next) missing.push(f.label);
      else values[f.key] = next;
    }
    if (missing.length) throw new Error(`${PROVIDER_META[provider].title}: missing ${missing.join(', ')}`);
    kept.push(PROVIDER_META[provider].title);
  }
  const months = Math.min(36, Math.max(1, parseInt(body.months, 10) || 12));
  writeFileSync(ENV_PATH, renderEnv(values, months));
  chmodSync(ENV_PATH, 0o600);
  return { summary: `Set up: ${kept.join(', ')}. History depth: ${months} months.`, kept, months };
}

const state = savedState(loadEnv());

const server = createServer((req, res) => {
  // Loopback only: reject anything that reached us under another host name
  // (blocks DNS-rebinding from a page in the same browser).
  const host = (req.headers.host || '').split(':')[0];
  if (host !== '127.0.0.1') {
    res.writeHead(403).end('forbidden');
    return;
  }
  const url = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'GET' && url.pathname === '/') {
    if (!tokenOk(url.searchParams.get('t'))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Open the full link, including ?t=… — it was printed when the form started.');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(page(state, TOKEN, monthsBack()));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/save') {
    if (!tokenOk(req.headers['x-setup-token'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' }).end('{"ok":false,"error":"bad token"}');
      return;
    }
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 64 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        const result = save(JSON.parse(raw));
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, summary: result.summary }));
        console.log(`\n  ✓ wrote ${ENV_PATH} (${result.kept.join(', ')}; ${result.months} months of history)`);
        console.log('  Now ask your agent to refresh a bank.\n');
        setTimeout(() => server.close(() => process.exit(0)), 400);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404).end('not found');
});

server.listen(0, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}/?t=${TOKEN}`;
  console.log('\n  kesef.ai setup form is open in your browser.');
  console.log(`  If no tab appeared, open this link yourself:\n\n  ${url}\n`);
  console.log(`  Credentials go to ${ENV_PATH} and stay on this machine; the form exits after saving.`);
  console.log('  Ctrl+C cancels without saving.\n');
  // KESEF_SETUP_NO_OPEN=1 — print the URL only (headless box, SSH, smoke test).
  if (process.env.KESEF_SETUP_NO_OPEN) return;
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  const child = spawn(opener, [url], { stdio: 'ignore', detached: true, shell: process.platform === 'win32' });
  child.on('error', () => console.log('  (the browser did not open by itself — copy the link above)'));
  child.unref();
});
