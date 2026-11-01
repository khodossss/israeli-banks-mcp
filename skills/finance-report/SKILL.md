---
name: finance-report
description: Build a personal or household finance report from the kesef bank connector — spending by category, income, subscriptions, and a concrete balance reconciliation. Use when the user asks for a finance report, a monthly summary, "how much did I spend", or "how much can I actually spend".
---

# Finance report from kesef

Build the report from the `kesef` MCP tools. The period may be given with the request
(e.g. `/kesef:finance-report June–July`).

## Flow

1. **Settle the period first** — before anything about refreshing. Take it from the
   request; if none was given, ask the user which period to analyse (a good default:
   the current and previous month). Do not go further until the period is set.
2. **Find the configured providers** with `providers`. Only those exist on this
   machine; never assume a fixed bank/card set. If none is configured, run `setup`
   and stop until the user has saved the form.
3. **Check whether the period is covered** with `status` (last refresh per provider,
   row counts) and, if needed, `get_transactions` for the period.
   - Data for the period is there and fresh enough → **do not ask about refreshing**;
     go straight to the analysis.
   - Data is missing or stale (e.g. the current month was requested and the last
     refresh is a week old) → ask the user, as a choice, whether to refresh: all
     providers / a specific one / use what is stored. Say when each was last refreshed.
     `refresh` is interactive: it opens a browser, and for Hapoalim the user types an
     SMS code, for Isracard they may pass a Cloudflare check — so only while the user
     is at the computer.
4. If refreshing, call `refresh` once per provider, one at a time.
5. **Take every balance and spending figure from `reconcile`** — `currentBalance`,
   `pendingCardBill`, `availableBalance` and the period ledger (`cardConsumption`,
   `cardRepaymentsDebited`). Show them as numbers, not words.
6. **Report structure:** spending (by category / merchant), income, recurring charges
   and subscriptions, the period balance (income − spending), and the reconciliation.

## The one rule that keeps figures honest

Card spending and the bank balance change are **different numbers — never add them up.**
The bank account moves through lump card-bill repayments; the itemized purchases live
on the card. When you categorise spending from `get_transactions`, take card purchases
from the card providers and leave out the bank's lump card-repayment debits — `reconcile`
already tells them apart (`cardRepaymentsDebited` vs `cardConsumption`); do not match
them by hand.

## Household mode

When the user is in a family budget and asks for the joint picture, pass
`scope: "household"` to `reconcile`, `get_transactions` and `list_accounts`. The report
then has:

- a section per family member (balance, spending, income);
- the household totals;
- each member's freshness (last refresh) from `family_status`, so stale figures are visible.

Reconciliation runs per member and is then summed — a card repayment is only ever
matched with the same member's bank.
