import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// KESEF_HOME is resolved at import, so point it at a scratch dir first.
const home = mkdtempSync(join(tmpdir(), 'kesef-env-'));
process.env.KESEF_HOME = home;
delete process.env.SCRAPE_MONTHS_BACK;
const { loadEnv, listProviders, setting, monthsBack, envPath } = await import('../config.mjs');

const writeEnv = lines => writeFileSync(join(home, '.env'), lines.join('\n'));

test('.env lives in KESEF_HOME', () => {
  assert.equal(envPath(), join(home, '.env'));
});

test('commented-out keys, empty values and .env.example placeholders are inactive', () => {
  writeEnv([
    '# LEUMI_USERNAME=real_user',
    '#LEUMI_PASSWORD=real_pass',
    'CAL_USERNAME=',
    'ISRACARD_ID=your_teudat_zehut',
    'ISRACARD_CARD6DIGITS=last_6_digits_of_card',
    'HAPOALIM_USERCODE=AB123',
    'HAPOALIM_PASSWORD=secret',
  ]);
  assert.deepEqual(loadEnv(), { HAPOALIM_USERCODE: 'AB123', HAPOALIM_PASSWORD: 'secret' });
  const configured = listProviders()
    .filter(p => p.configured)
    .map(p => p.provider);
  assert.deepEqual(configured, ['hapoalim']);
});

test('settings come from the environment first, then .env, then the default', () => {
  writeEnv(['SCRAPE_MONTHS_BACK=6', 'CHROME_PATH=C:/chrome.exe']);
  assert.equal(monthsBack(), 6);
  assert.equal(setting('CHROME_PATH'), 'C:/chrome.exe');
  process.env.SCRAPE_MONTHS_BACK = '3';
  assert.equal(monthsBack(), 3);
  delete process.env.SCRAPE_MONTHS_BACK;
  writeEnv([]);
  assert.equal(monthsBack(), 12);
});
