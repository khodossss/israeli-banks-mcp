// Household identity + config, read from / written to the .env in KESEF_HOME.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { envPath, loadEnv, DEFAULT_RELAY_URL } from '../../config.mjs';

export function writeEnvKeys(patch) {
  const path = envPath();
  const lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(patch)) {
    const idx = lines.findIndex(l => new RegExp(`^#?\\s*${key}=`).test(l));
    const rendered = value === null ? null : `${key}=${String(value).replace(/[\r\n]+/g, ' ')}`;
    if (idx >= 0) {
      if (rendered === null) lines.splice(idx, 1);
      else lines[idx] = rendered;
    } else if (rendered !== null) {
      lines.push(rendered);
    }
  }
  writeFileSync(path, lines.join('\n'));
}

export function newMemberId() {
  return 'm_' + randomBytes(6).toString('base64url').slice(0, 8);
}

export function loadHousehold() {
  const env = loadEnv();
  if (!env.HOUSEHOLD_STORAGE) return null;
  return {
    storage: env.HOUSEHOLD_STORAGE,
    dir: env.HOUSEHOLD_DIR || null,
    token: env.HOUSEHOLD_TOKEN || null,
    relayUrl: env.RELAY_URL || DEFAULT_RELAY_URL,
    member: { id: env.MEMBER_ID || null, info: env.MEMBER_INFO || '' },
  };
}

export function displayName(member, index) {
  return member && member.info ? member.info : `Member ${index + 1}`;
}
