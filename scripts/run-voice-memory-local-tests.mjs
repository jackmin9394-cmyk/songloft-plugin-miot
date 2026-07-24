#!/usr/bin/env node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';

const root = resolve(import.meta.dirname, '..');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'songloft-miot-memory-local-'));
const output = join(temporaryRoot, 'voice_memory_local_preference.test.mjs');
try {
  buildSync({
    entryPoints: [join(root, 'tests', 'voice_memory_local_preference.test.ts')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'warning',
  });
  const result = spawnSync(process.execPath, ['--test', output], {
    cwd: root,
    stdio: 'inherit',
  });
  process.exitCode = result.status === null ? 1 : result.status;
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
