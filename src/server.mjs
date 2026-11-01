// MCP server (stdio) for the user-assisted Israeli-bank connector.
// Tools: refresh (interactive, opens a browser), and read-only queries over the
// local SQLite store. Only JSON-RPC goes to stdout; progress goes to stderr.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { refresh, warmup } from './refresh.mjs';
import * as store from './store.mjs';
import { inspect } from 'node:util';
import { readFileSync } from 'node:fs';
import { listProviders } from '../config.mjs';
import { TOOLS, PROVIDER_ENUM } from './tool-defs.mjs';
import { openSetupForm } from './setup.mjs';
import {
  familyCreate,
  familyJoin,
  familyLeave,
  familyStatus,
  familySync,
  familySummary,
  householdView,
  householdTxns,
} from './household/index.mjs';
import { loadHousehold } from './household/identity.mjs';

// MCP stdio: stdout must carry ONLY JSON-RPC. Route any stray console.log/info/
// debug/warn (from puppeteer, the scraper library, or our code) to stderr so it
// can't corrupt the protocol stream and drop the connection ("Connection closed").
// MUST be bulletproof: it runs inside library code, so it must never throw (use
// util.inspect for circular objects, and swallow any write error). The SDK writes
// protocol frames via process.stdout directly, unaffected by this.
for (const m of ['log', 'info', 'debug', 'warn']) {
  console[m] = (...a) => {
    try {
      process.stderr.write(a.map(x => (typeof x === 'string' ? x : inspect(x))).join(' ') + '\n');
    } catch {
      /* never throw into caller */
    }
  };
}
// Never let a stray async error kill the server.
process.on('unhandledRejection', e => process.stderr.write(`[kesef] unhandledRejection: ${e?.stack || e}\n`));
process.on('uncaughtException', e => process.stderr.write(`[kesef] uncaughtException: ${e?.stack || e}\n`));

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const server = new Server({ name: 'kesef', version }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

const text = obj => ({
  content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2) }],
});

// Progress goes to stderr and, when the client asked for it (progressToken), out
// as notifications/progress — so a long refresh shows what it is waiting for.
function progressReporter(label, request, extra) {
  const token = request.params._meta?.progressToken;
  let step = 0;
  return message => {
    console.error(`[${label}] ${message}`);
    if (token === undefined) return;
    extra
      .sendNotification({
        method: 'notifications/progress',
        params: { progressToken: token, progress: ++step, message },
      })
      .catch(() => {});
  };
}

server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args = {} } = request.params;
  try {
    switch (name) {
      case 'setup':
        return text(await openSetupForm());
      case 'providers':
        return text(listProviders());
      case 'warmup': {
        if (!PROVIDER_ENUM.includes(args.provider))
          throw new Error(`provider must be one of: ${PROVIDER_ENUM.join(', ')}`);
        return text(
          await warmup(args.provider, { onProgress: progressReporter(`warmup:${args.provider}`, request, extra) }),
        );
      }
      case 'refresh': {
        const provider = args.provider;
        if (!PROVIDER_ENUM.includes(provider)) throw new Error(`provider must be one of: ${PROVIDER_ENUM.join(', ')}`);
        const onProgress = progressReporter(`refresh:${provider}`, request, extra);
        const result = await refresh(provider, { monthsBack: args.monthsBack, onProgress });
        const saved = store.save(result, new Date().toISOString());
        // The data is saved: from here on nothing may turn this refresh into an
        // error, or the user repeats the login (and the SMS) for nothing.
        let familySynced = false;
        let household = null;
        try {
          if (loadHousehold()) {
            await familySync();
            familySynced = true;
            household = await familySummary();
          }
        } catch (e) {
          console.error(`[refresh:${provider}] family sync/summary skipped: ${e.message}`);
        }
        let summary;
        try {
          summary = store.refreshSummary();
        } catch (e) {
          summary = { error: `summary unavailable: ${e.message}` };
        }
        return text({
          ok: true,
          provider,
          ...saved,
          familySynced,
          summary,
          ...(household && { household }),
          note: household
            ? 'Show `summary` (your accounts) and `household` (a row per member plus the family total) to the user now as short tables; flag any member whose lastRefresh is over a week old. Then offer the finance-report skill for the full breakdown.'
            : 'Show `summary` to the user now as a short table, then offer the finance-report skill for the full breakdown.',
        });
      }
      case 'list_accounts':
        if (args.scope === 'household') return text((await householdView(args)).accounts);
        return text(store.listAccounts(args.provider));
      case 'get_transactions':
        if (args.scope === 'household') return text(store.flagCardRepayments(await householdTxns(args)));
        return text(store.flagCardRepayments(store.getTransactions(args)));
      case 'status':
        return text(store.status());
      case 'reconcile':
        if (args.scope === 'household') return text((await householdView(args)).reconcile);
        return text(store.reconcile(args));
      case 'family_create':
        return text(await familyCreate(args));
      case 'family_join':
        return text(await familyJoin(args));
      case 'family_leave':
        return text(await familyLeave());
      case 'family_status':
        return text(await familyStatus(args));
      case 'family_sync':
        return text(await familySync());
      default:
        throw new Error(`unknown tool: ${name}`);
    }
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: `Error in ${name}: ${e.message}` }] };
  }
});

await server.connect(new StdioServerTransport());
console.error('[kesef] MCP server ready (stdio)');
