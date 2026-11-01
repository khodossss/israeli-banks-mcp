# kesef.ai

**Private analysis of your real Israeli bank data, inside Claude Code or Codex.**

kesef pulls your balances and transactions from Israeli banks and credit cards into your
AI agent, so you can ask for what a spreadsheet won't give you: spending by category,
recurring subscriptions, month-over-month trends, "how much can I actually spend right
now" — and, in family mode, the same picture for a whole household.

It is a **local, read-only** MCP connector. Logins happen in a real browser window on
your machine, which gets past what breaks headless scraping (Hapoalim's SMS 2FA,
Isracard's Cloudflare). Credentials and data never leave your computer. It never moves
money.

## Supported banks and cards

| Provider      | Type        | What you do when it refreshes                                          |
| ------------- | ----------- | ---------------------------------------------------------------------- |
| Bank Hapoalim | bank        | Type the SMS code — username and password are filled in for you        |
| Bank Leumi    | bank        | Usually nothing; a one-time `warmup` if Leumi asks to trust the device |
| Isracard      | credit card | Pass the Cloudflare check if one appears                               |
| Cal (כאל)     | credit card | Usually nothing                                                        |

Configure only the ones you have.

## Quick start

You need **Node.js 22+** and **Google Chrome or Microsoft Edge**.

**Claude Code**

```
/plugin marketplace add khodossss/kesef.ai
/plugin install kesef@kesef-ai
```

**Codex** — see [INSTALL.md](INSTALL.md#codex).

Then, in a new session:

1. _"Set up kesef"_ — a local form opens in your browser. Tick your banks, enter the
   credentials, save.
2. _"Refresh Hapoalim"_ (or any provider) — a browser window opens; do the step from the
   table above.
3. Ask away, or run `/kesef:finance-report` for a structured report.

Manual installs, updating, and troubleshooting: **[INSTALL.md](INSTALL.md)**.

## What to ask

- _"How much did I spend in July, by category?"_
- _"What am I paying for every month?"_
- _"Compare June and July."_ · _"Is my grocery spending growing?"_
- _"How much can I actually spend?"_ — balance minus the card bills still to come.
- `/kesef:finance-report June–July` — spending, income, subscriptions, and a balance
  reconciliation.

Data is stored locally after each refresh; questions read from that store, so no new
login is needed until you want fresher figures.

## Tools

| Tool                                                                           | What it does                                                                              |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `setup`                                                                        | Opens the local credentials form                                                          |
| `providers`                                                                    | Which banks/cards are configured on this machine, and the human step for each             |
| `refresh`                                                                      | Opens the browser, waits for your step, stores fresh data; reports progress while it runs |
| `warmup`                                                                       | One-time manual login with "trust this device", so later refreshes need no code           |
| `list_accounts`, `get_transactions`, `status`                                  | Read the stored data; transactions flag bank card-bill debits as `card_repayment`         |
| `reconcile`                                                                    | Current balance, pending card bill, available balance, and a period ledger                |
| `family_create`, `family_join`, `family_status`, `family_sync`, `family_leave` | Family mode — see [FAMILY.md](FAMILY.md)                                                  |

**Why figures don't double-count:** the bank balance moves through lump card-bill
repayments, while the card holds the itemized purchases. They are two views of the same
money, so kesef never adds them up — `reconcile` reports both separately.

## Family mode

Each member runs kesef on their own machine and refreshes their own accounts; reports can
then cover the whole household. Only credential-free snapshots travel between machines,
end-to-end encrypted in relay mode. See **[FAMILY.md](FAMILY.md)**.

## Privacy and safety

- **Credentials stay on your machine** — in a local `.env` (in `~/.kesef` by default). The
  Hapoalim SMS code is typed in the bank's own page and stored nowhere.
- **Read-only.** No payments, no transfers — ever.
- **Solo use is fully local.** Nothing is sent anywhere.
- **Family snapshots carry no secrets** — only balances, transactions and refresh times.
  In relay mode they are sealed with AES-256-GCM using a key derived from your family
  token; the relay stores ciphertext and a verifier that cannot decrypt anything.
- **The family token is a credential** — kept in `.env`, redacted in output. Share it
  privately.

## For developers

See [AGENTS.md](AGENTS.md) for the architecture, conventions and known traps.
`npm run verify` runs the full gate (syntax, lint, format, tests).
