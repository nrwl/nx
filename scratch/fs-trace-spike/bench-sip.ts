// Per-exec cost of the SIP rewrite: node starting /bin/sh -c true N times, traced.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ensureSipCopyDir } from './sip/sip-copy-dir';

const { traceSpawn } = require('./fstrace.node');
const shimPath = path.join(
  __dirname,
  '../../packages/nx/src/native/fstrace.darwin.dylib'
);
const N = 200;
const loop = [
  process.execPath,
  [
    '-e',
    `for (let i = 0; i < ${N}; i++) require('child_process').execFileSync('/bin/sh', ['-c', 'true'])`,
  ],
];

async function time(backend: string, sipDir?: string) {
  if (sipDir) process.env.FSTRACE_SIP_DIR = sipDir;
  else delete process.env.FSTRACE_SIP_DIR;
  const t = process.hrtime.bigint();
  const r = await traceSpawn(loop[0], loop[1], {
    backend,
    shimPath,
    cwd: __dirname,
  });
  if (r.exitCode !== 0) throw new Error(`exit ${r.exitCode}`);
  return Number(process.hrtime.bigint() - t) / 1e6;
}

async function main() {
  const sipDir = ensureSipCopyDir()!;
  const cold = mkdtempSync(path.join(tmpdir(), 'sip-cold-'));
  const coldMs = await time('preload', cold);
  rmSync(cold, { recursive: true });
  const rows: Record<string, string> = {
    'first run, empty copy dir': `${coldMs.toFixed(0)} ms`,
  };
  for (const [name, backend, dir] of [
    ['untraced', 'none', undefined],
    ['traced, no rewrite', 'preload', undefined],
    ['traced, rewrite (warm)', 'preload', sipDir],
  ] as const) {
    const s = [];
    for (let i = 0; i < 5; i++) s.push(await time(backend, dir));
    s.sort((a, b) => a - b);
    rows[name] = `${s[2].toFixed(0)} ms (${(s[2] / N).toFixed(2)} ms per exec)`;
  }
  console.table(rows);
}

main();
