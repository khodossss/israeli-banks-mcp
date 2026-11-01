// MCP tool declarations (names, descriptions, input schemas) for src/server.mjs.

import { PROVIDERS } from '../config.mjs';

export const PROVIDER_ENUM = Object.keys(PROVIDERS); // e.g. hapoalim, leumi, isracard, cal

export const TOOLS = [
  {
    name: 'setup',
    description:
      'Open the local setup form in the user’s browser to enter or change bank/card credentials and history depth. Use it when `providers` shows nothing configured, or when the user wants to add or change a bank. Returns a 127.0.0.1 link — give it to the user in case no tab opened. The form writes the local .env and exits after saving; no restart is needed — call `providers` again afterwards.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'providers',
    description:
      'List which providers are configured on THIS machine (credentials present) and their login mode. ALWAYS call this first — the bank/card combination differs per user; never assume a fixed set. Each entry: provider, kind (bank|card), configured, loginMode, humanStep. Ask the user only about configured providers; if none is configured, call `setup`.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'warmup',
    description:
      'One-time manual login for a provider. Opens a real browser; the user logs in and ticks "trust this device" (and passes Cloudflare for cards), then closes the window. Persists the trust/cf_clearance cookie in the profile so later refresh() runs go through without OTP/Cloudflare. Use this first for banks whose automated login needs a trusted device (e.g. Leumi), or when refresh reports a login failure. Blocks until the user closes the window.',
    inputSchema: {
      type: 'object',
      properties: { provider: { type: 'string', enum: PROVIDER_ENUM } },
      required: ['provider'],
    },
  },
  {
    name: 'refresh',
    description:
      'Fetch fresh balance + transactions for a provider. Opens a REAL browser window on the user’s screen; the user completes only the human step there (see `providers` → humanStep: Hapoalim — type the SMS code, username/password are auto-filled; Isracard — pass the Cloudflare check; Leumi and Cal — usually nothing). Long-running (up to a few minutes); progress is reported while it runs. Data is stored locally. The result carries `summary` (currentBalance, pendingCardBill, availableBalance, and cardSpending / bankCredits for thisMonth and lastMonth): right after a refresh, show it to the user as a short table without being asked, then offer the finance-report skill for categories and subscriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: PROVIDER_ENUM, description: 'Which provider to refresh' },
        monthsBack: {
          type: 'number',
          description: 'How many months of history (default: SCRAPE_MONTHS_BACK, else 12)',
        },
      },
      required: ['provider'],
    },
  },
  {
    name: 'list_accounts',
    description:
      'List stored accounts/cards with their latest balance and when they were last updated. Reads local data only — no browser.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: PROVIDER_ENUM },
        scope: {
          type: 'string',
          enum: ['own', 'household'],
          description: 'own (this machine) or household (whole family)',
        },
      },
    },
  },
  {
    name: 'get_transactions',
    description:
      'Query stored transactions. Filters: provider, from/to (ISO date), search (matches description/memo), limit. Each row carries card_repayment: true for a bank’s lump card-bill debit — leave those out of spending (the itemized card purchases are the spending). Reads local data only — no browser.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: PROVIDER_ENUM },
        from: { type: 'string', description: 'ISO date lower bound (transaction date)' },
        to: { type: 'string', description: 'ISO date upper bound' },
        search: { type: 'string', description: 'substring in description/memo' },
        limit: { type: 'number', description: 'max rows (default 500)' },
        scope: { type: 'string', enum: ['own', 'household'], description: 'own or household' },
      },
    },
  },
  {
    name: 'status',
    description: 'Show, per provider, when data was last refreshed and how many accounts/transactions are stored.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'reconcile',
    description:
      'Concrete balance reconciliation. Returns currentBalance, pendingCardBill (recent card purchases not yet debited), and availableBalance (= balance − upcoming bill). IMPORTANT: card spending (itemized card purchases) is a DIFFERENT number from the balance change — the balance moves via lump card repayments, never sum both. Pass from/to for a period ledger check (implied start balance, repayments vs consumption). Use this whenever reporting balance/spending so figures are concrete.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'ISO date lower bound for the ledger check' },
        to: { type: 'string', description: 'ISO date upper bound for the ledger check' },
        scope: { type: 'string', enum: ['own', 'household'], description: 'own or household' },
      },
    },
  },
  {
    name: 'family_create',
    description:
      'Start a family budget. mode "relay" (default): creates an E2E room and returns a TOKEN to share with family members — they run family_join with it. mode "local": set dir to a shared/synced folder (you sync it yourself). Optional info is a free label shown in reports (e.g. "Dima"); leave empty and you show as "Member N".',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['relay', 'local'], description: 'relay (token) or local (shared folder)' },
        info: { type: 'string', description: 'optional display label for you' },
        dir: { type: 'string', description: 'local mode only: path to the shared/synced folder' },
      },
    },
  },
  {
    name: 'family_join',
    description:
      'Join an existing family budget. Relay: pass the token you were given. Local: pass the same shared folder path (dir). Optional info is your display label.',
    inputSchema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'relay token (kesef1.…)' },
        dir: { type: 'string', description: 'local mode: shared folder path' },
        info: { type: 'string', description: 'optional display label for you' },
      },
    },
  },
  {
    name: 'family_leave',
    description: 'Leave the family: remove your snapshot from the shared store and clear family keys from .env.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'family_status',
    description:
      "Show family mode: who you are, storage mode, the members seen and each one's freshness (last_refresh). Pass setInfo to change your own display label.",
    inputSchema: { type: 'object', properties: { setInfo: { type: 'string', description: 'new display label' } } },
  },
  {
    name: 'family_sync',
    description:
      'Push your latest snapshot to the family store (encrypted in relay mode) and pull the others. Runs automatically after refresh; call manually to force a sync.',
    inputSchema: { type: 'object', properties: {} },
  },
];
