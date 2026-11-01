# Installing kesef

## Requirements

- **Node.js 22 or newer** (kesef uses the built-in `node:sqlite`). Check: `node --version`.
- **Google Chrome or Microsoft Edge.** kesef drives your installed browser; it never
  downloads Chromium.
- **Claude Code** or **Codex**.

Tested on Windows. macOS and Linux work too; if your browser is somewhere unusual, set
`CHROME_PATH` (see [Settings](#settings)).

## Claude Code

In a Claude Code session:

```
/plugin marketplace add khodossss/israeli-banks-mcp
/plugin install kesef@kesef-ai
```

Or from a terminal: `claude plugin marketplace add khodossss/israeli-banks-mcp`, then
`claude plugin install kesef@kesef-ai`.

Start a new session. The plugin brings the kesef MCP server (named `bank` inside the plugin) and the
`/kesef:finance-report` skill.

**Updates:** third-party marketplaces don't auto-update by default. Run
`claude plugin marketplace update kesef-ai`, then `claude plugin update kesef@kesef-ai`
(or turn on auto-update for the marketplace in `/plugin`).

## Codex

```
codex plugin marketplace add khodossss/israeli-banks-mcp
codex plugin add kesef@kesef-ai
```

Start a new session. The plugin brings the kesef MCP server (named `bank`) and the `finance-report`
skill (invoke it with `$finance-report`, or just ask for a finance report).

**Updates:** `codex plugin marketplace upgrade kesef-ai`.

**Known Codex limits:**

- Codex does not show MCP progress messages, so a `refresh` looks silent until it ends —
  watch the browser window instead.
- If `refresh` times out while you are still typing the SMS code, register the server
  manually with a longer timeout (below) instead of the plugin.

## First start

On its first start (and after each plugin update) the server installs its runtime
dependencies, which takes ~15 seconds. If the agent reports that the server failed to
start, start a new session; if it still fails, run `npm ci --omit=dev` in the plugin
folder named in the server's error output.

## Set up your banks

Ask your agent: _"set up kesef"_. A form opens in your browser (local only, on
127.0.0.1). Tick the banks and cards you use, fill in the credentials and the months of
history to fetch, and save. No restart is needed — ask _"refresh Hapoalim"_ (or any
provider) next.

The form writes `.env` in your kesef home folder: **`~/.kesef`** by default. That folder
also holds `data/bank.db` (your transactions) and `profiles/` (browser sessions). It is
kept outside the plugin, so updates never touch it, and both agents share it.

### Leumi: trust this device

If Leumi's automatic login fails, run a one-time warmup: _"warmup Leumi"_. A window opens;
log in by hand, tick **"trust this device"**, reach the account page and close the
window. Later refreshes then log in silently while the trust cookie lasts.

## Settings

Set these in `.env` (or as environment variables of the MCP server, which win over
`.env`):

| Key                  | Default | Meaning                                        |
| -------------------- | ------- | ---------------------------------------------- |
| `SCRAPE_MONTHS_BACK` | `12`    | Months of history each refresh fetches         |
| `CHROME_PATH`        | auto    | Browser executable, if not in a standard place |

`KESEF_HOME` moves the whole kesef folder; it can only be set as an environment variable,
since `.env` lives inside it.

To disable a provider, delete its lines from `.env` (a commented-out key is inactive too).

## Manual install (without the plugin system)

```
git clone https://github.com/khodossss/israeli-banks-mcp.git
cd israeli-banks-mcp
npm ci
npm run setup
```

`npm run setup` opens the same credentials form. In a checkout that already has `.env`
at its root, kesef keeps using that folder as its home (the layout before the plugin).

Register the server with the absolute path to `src/server.mjs`:

- **Claude Code:** `claude mcp add kesef --scope user -- node C:/path/to/israeli-banks-mcp/src/server.mjs`
- **Codex:** add to `~/.codex/config.toml`:

  ```toml
  [mcp_servers.kesef]
  command = "node"
  args = ["C:/path/to/israeli-banks-mcp/src/server.mjs"]
  startup_timeout_sec = 60
  tool_timeout_sec = 900
  ```

The finance-report skill is `skills/finance-report/SKILL.md`; copy that folder to
`~/.claude/skills/` (Claude Code) or `~/.agents/skills/` (Codex).

### Moving from a manual install to the plugin

Remove the old registration first (`claude mcp remove kesef -s user`, or delete the
`[mcp_servers.kesef]` block), or the agent runs two copies. Then move `.env`, `data/` and
`profiles/` from the checkout into `~/.kesef` so the plugin finds your credentials and
history.

## Add another bank or card

`israeli-bank-scrapers` supports many more providers. For one that logs in with stored
credentials (like Leumi or Cal), add an entry to `PROVIDERS` in `config.mjs` — the generic
library path in `src/refresh.mjs` handles it — and its fields in `tools/setup-page.mjs`.
For a card, also add the issuer's spellings to `CARD_REPAY_RE` in `src/store.mjs` and pin
them in `test/reconcile-dataset.test.mjs` (see [AGENTS.md](AGENTS.md)). A bank with SMS
2FA needs its own extractor, like `src/extractors/hapoalim.mjs`.

## Troubleshooting

| Symptom                              | Fix                                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `No system Chrome/Edge found`        | Install Chrome, or set `CHROME_PATH` in `.env`                                          |
| Error about `node:sqlite`            | Upgrade to Node.js 22+                                                                  |
| `providers` shows nothing configured | Ask _"set up kesef"_ and save the form                                                  |
| `refresh` seems stuck                | Don't close the window — finish the login there (SMS code, Cloudflare); it waits ~8 min |
| Cloudflare check won't pass          | Wait, or tick "I'm not a robot" in the window                                           |
| Hapoalim autofill didn't work        | Log in by hand in the window; the flow continues                                        |
| Leumi reports invalid credentials    | Check them in the form; if they're right, run _"warmup Leumi"_                          |
| Server failed to start on first use  | See [First start](#first-start)                                                         |
| The agent doesn't see kesef          | Start a new session; check `/plugin` (Claude Code) or `codex mcp list` (Codex)          |
