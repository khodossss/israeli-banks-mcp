// `setup` tool: spawn the one-shot setup form (tools/setup-form.mjs) and hand back
// its link once it is listening. The form opens the browser itself, writes .env
// and exits after saving; its output goes to our stderr, never to the MCP stdout.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { envPath } from '../config.mjs';

const FORM = fileURLToPath(new URL('../tools/setup-form.mjs', import.meta.url));
const LINK = /http:\/\/127\.0\.0\.1:\d+\/\?t=[\w-]+/;

export function openSetupForm() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [FORM], { stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => reject(new Error('setup form did not start within 20s')), 20000);
    let out = '';
    child.stdout.on('data', chunk => {
      process.stderr.write(chunk);
      out += chunk;
      const link = out.match(LINK);
      if (link) {
        clearTimeout(timer);
        resolve({
          url: link[0],
          envPath: envPath(),
          note: 'The form should have opened in the browser; if not, give the user this link. Call providers after the user saves.',
        });
      }
    });
    child.stderr.on('data', chunk => process.stderr.write(chunk));
    child.on('error', e => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('exit', code => {
      clearTimeout(timer);
      reject(new Error(`setup form exited (code ${code}) before it was ready`));
    });
  });
}
