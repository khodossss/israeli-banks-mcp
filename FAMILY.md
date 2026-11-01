# Family mode — a household budget

Each family member installs kesef on their own machine ([INSTALL.md](INSTALL.md)) and
refreshes **their own** accounts there. Reports can then cover just your accounts
(`scope: own`, the default) or the whole family (`scope: household`): a section per
member plus household totals, with each member's last refresh shown so stale figures
are visible.

Between machines only a **snapshot** travels — balances, transactions and refresh times.
Never credentials, cookies or passwords.

## Choose a storage mode

|               | `relay` (recommended)                 | `local`                                  |
| ------------- | ------------------------------------- | ---------------------------------------- |
| Shared medium | a Cloudflare Worker                   | a folder you sync yourself (OneDrive, …) |
| Joining       | paste a token                         | point at the same folder                 |
| Encryption    | end-to-end, AES-256-GCM               | plaintext files in **your** folder       |
| Manual work   | none                                  | you keep the folder in sync              |
| Setup         | the default relay, or deploy your own | nothing to deploy                        |

**Relay.** By default kesef uses the maintainer's relay (`DEFAULT_RELAY_URL` in
`config.mjs`). It is zero-knowledge — it stores only a verifier and sealed blobs it cannot
decrypt — but if you'd rather depend on no one, deploy your own Worker once
([relay/README.md](relay/README.md)) and set `RELAY_URL` in every member's `.env`.

## Set up

### Relay

1. One member asks: _"create a family budget"_ → `family_create` returns a **token**.
2. Share the token privately with the others. It works like a password: whoever holds it
   can read the family's snapshots.
3. Each other member asks: _"join the family with token …"_ → `family_join`.
4. Optional display name: _"set my family name to Dima"_ (`family_status` with
   `setInfo`); otherwise you appear as "Member N".

### Local folder

1. One member: `family_create` with `mode: "local"` and `dir: "<shared folder>"`.
2. The others: `family_join` with the same `dir`.
3. Keeping the folder in sync (cloud drive or by hand) is up to you.

## Use it

The same questions as solo, for the whole family:

- `/kesef:finance-report July household` — a joint report: a section per member plus totals.
- _"family balance"_, _"how much did the family spend in July"_ — read tools with
  `scope: household`.
- `family_status` — who is in the family and when each member last refreshed.

Reconciliation runs **per member, then sums**: a card repayment is only ever matched
with the same member's bank, never across people.

## Sync

`family_sync` runs automatically after every `refresh`. To force it: _"sync the family"_.
To leave: `family_leave` removes your snapshot from the shared store and the family keys
from your `.env`.
