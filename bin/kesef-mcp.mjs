#!/usr/bin/env node
// Plugin entry point for Claude Code and Codex. A plugin is installed as a copy of
// the repo without node_modules: Claude Code installs dependencies itself (within a
// time limit), Codex never does. So on a first start — and after each plugin update,
// which replaces the copy — install the runtime dependencies here, then start the
// MCP server. npm output goes to stderr: stdout carries only the MCP stream.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));

if (!existsSync(join(root, 'node_modules', '@modelcontextprotocol', 'sdk', 'package.json'))) {
  process.stderr.write('[kesef] first start: installing dependencies (npm ci --omit=dev)…\n');
  // A fixed command string through the shell: npm is npm.cmd on Windows.
  const r = spawnSync('npm ci --omit=dev --ignore-scripts --no-audit --no-fund', {
    cwd: root,
    stdio: ['ignore', 2, 2],
    shell: true,
  });
  if (r.status !== 0) {
    process.stderr.write(`[kesef] dependency install failed — run \`npm ci --omit=dev\` in ${root}\n`);
    process.exit(1);
  }
}

await import('../src/server.mjs');
