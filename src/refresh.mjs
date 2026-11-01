// Refresh dispatcher. Opens a REAL visible browser; the human clears whatever gate
// the provider needs, then data is extracted.
//   - hapoalim: we drive page 0 (auto-fill creds), human enters the SMS OTP, then
//     extract from the live authenticated session (2FA can't be automated).
//   - leumi / isracard: the LIBRARY launches its own browser (mode B) with a
//     persistent profile and does login + extraction itself. We do NOT inject our
//     own browserContext — doing that from inside the MCP stdio server makes the
//     library's newPage fail ("Failed to open a new tab"). Isracard's Cloudflare and
//     any bank's "trust this device" are cleared by the human in that window (and a
//     one-time warmup persists the trust/clearance cookie for later silent runs).
// Returns { provider, accounts:[{accountNumber, balance, currency, txns[]}] }.

import puppeteer from 'puppeteer-core';
import { createScraper } from 'israeli-bank-scrapers-core';
import { getChrome, profileDir, getCredentials, monthsBack as defaultMonthsBack, PROVIDERS } from '../config.mjs';
import { extractHapoalim } from './extractors/hapoalim.mjs';

function log(onProgress, msg) {
  if (onProgress) onProgress(msg);
}

const COMMON_ARGS = [
  '--start-maximized',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-blink-features=AutomationControlled',
];

// One-time manual login into a persistent profile. The human logs in, ticks
// "trust this device" (and passes Cloudflare for cards), reaches the account page,
// then CLOSES the window. The device-trust / cf_clearance cookie stays in the
// profile so later refresh() runs go through without OTP/Cloudflare. This is the
// robust path for banks whose automated login needs a trusted device (e.g. Leumi).
export async function warmup(provider, { onProgress } = {}) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`unknown provider: ${provider}`);
  const browser = await puppeteer.launch({
    executablePath: getChrome(),
    headless: false,
    userDataDir: profileDir(provider),
    defaultViewport: null,
    args: COMMON_ARGS,
  });
  const [page] = await browser.pages();
  await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  log(
    onProgress,
    `Log in to ${provider} manually in the window: username, password, SMS code, and be sure to tick "trust this device". Reach the account page, then CLOSE the window.`,
  );
  await new Promise(resolve => browser.on('disconnected', resolve));
  return {
    provider,
    warmed: true,
    note: 'Profile warmed. refresh should now go through without SMS/Cloudflare while the trust cookie lasts.',
  };
}

export async function refresh(provider, { monthsBack = defaultMonthsBack(), onProgress } = {}) {
  const cfg = PROVIDERS[provider];
  if (!cfg) throw new Error(`unknown provider: ${provider}`);
  // Validate up front so a missing-cred error is a clean message, not a window flash.
  if (cfg.usesStoredCredentials) getCredentials(provider);
  getChrome(); // clear error if no browser is installed

  if (provider === 'hapoalim') {
    return refreshHapoalim(cfg, monthsBack, onProgress);
  }
  // leumi, isracard, and any other library-login provider
  return libScrape(cfg, provider, getCredentials(provider), monthsBack, onProgress);
}

// Hapoalim: our own browser; auto-fill creds; human types the SMS OTP; extract live.
async function refreshHapoalim(cfg, monthsBack, onProgress) {
  const browser = await puppeteer.launch({
    executablePath: getChrome(),
    headless: false,
    userDataDir: profileDir('hapoalim'),
    defaultViewport: null,
    args: COMMON_ARGS,
  });
  try {
    log(onProgress, 'opening Hapoalim — filling in username and password');
    const page = (await browser.pages())[0] || (await browser.newPage());
    await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await autofillHapoalim(page, cfg, onProgress);
    return await extractHapoalim(page, {
      monthsBack,
      onWait: (state, s) =>
        log(onProgress, `waiting for login to complete (${state}); ~${s}s left — type the SMS code in the window`),
    });
  } finally {
    await browser.close();
  }
}

async function autofillHapoalim(page, cfg, onProgress) {
  try {
    const creds = getCredentials('hapoalim');
    const { user, pass, submit } = cfg.login;
    await page.waitForSelector(user, { timeout: 30000 });
    await page.click(user, { clickCount: 3 }).catch(() => {});
    await page.type(user, creds.userCode, { delay: 25 });
    await page.type(pass, creds.password, { delay: 25 });
    log(onProgress, 'username and password filled in, clicking "log in" — now type only the SMS code');
    await page.click(submit);
  } catch (e) {
    log(onProgress, `autofill failed (${e.message}); log in manually in the window`);
  }
}

// Mode B: the library launches and drives its OWN browser (visible), with a
// persistent profile so a warmed "trust this device" / cf_clearance cookie lets
// later runs go through silently. Robust inside the MCP stdio server.
const PROGRESS_TEXT = {
  INITIALIZING: 'starting the browser…',
  START_SCRAPING: 'starting extraction…',
  LOGGING_IN: 'logging in automatically (credentials from .env)…',
  END_SCRAPING: 'data collected',
  TERMINATING: 'closing the window…',
};

async function libScrape(cfg, provider, creds, monthsBack, onProgress) {
  log(
    onProgress,
    `opening ${provider} — login is automatic; extraction takes ~1–2 minutes, just wait (pass the Cloudflare check in the window if it appears)`,
  );
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  const scraper = createScraper({
    companyId: cfg.companyId,
    startDate,
    combineInstallments: false,
    additionalTransactionInformation: false,
    showBrowser: true,
    executablePath: getChrome(),
    args: [...COMMON_ARGS, `--user-data-dir=${profileDir(provider)}`],
    timeout: 0, // no navigation timeout — gives the human time at Cloudflare / 2FA
    // page default timeout for ALL implicit waits. LOAD-BEARING for Leumi: its
    // library waitForPostLogin() races the success selectors (60s) against an
    // invalid-password waitForSelector that has NO explicit timeout, so it inherits
    // this default. Below ~60s the error branch rejects the race first and a
    // successful login is reported as GENERIC. The mode-B refactor dropped this
    // (was defaultTimeout:120000) — restoring it. Also covers slow account/tx loads.
    defaultTimeout: 120000,
  });
  // Surface the library's own progress so a slow run doesn't look stuck / like it
  // is waiting for the user to type (it logs in on its own).
  scraper.onProgress((companyId, payload) =>
    log(onProgress, `${companyId}: ${PROGRESS_TEXT[payload?.type] || payload?.type || ''}`),
  );
  const result = await scraper.scrape(creds);
  if (!result.success) throw new Error(`${provider} scrape failed: ${result.errorType} ${result.errorMessage || ''}`);
  return {
    provider,
    accounts: (result.accounts || []).map(a => ({
      accountNumber: String(a.accountNumber),
      balance: a.balance ?? null,
      currency: 'ILS',
      txns: a.txns || [],
    })),
  };
}
