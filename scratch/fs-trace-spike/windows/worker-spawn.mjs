// Spawns a node "worker" the way isolated-plugin.ts does when tracing is on, and checks
// stdout, the exit code and the read log with call markers.
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bin =
  process.env.FSTRACE_BIN ??
  path.resolve(here, '../../../packages/nx/src/native');
const tracer = path.join(bin, `fstrace-${process.arch}.exe`);
const log = path.join(here, 'worker-spawn.log');
const data = path.join(here, 'worker data.txt');
writeFileSync(log, '');
writeFileSync(data, 'hi');

const quote = (arg) => {
  if (arg && !/[\s"]/.test(arg)) return arg;
  let out = '"',
    bs = 0;
  for (const ch of arg) {
    if (ch === '\\') {
      bs++;
      continue;
    }
    out += '\\'.repeat(ch === '"' ? bs * 2 + 1 : bs) + ch;
    bs = 0;
  }
  return out + '\\'.repeat(bs * 2) + '"';
};
const workerCode = `
  const fs = require('fs');
  fs.appendFileSync(process.env.FSTRACE_OUT, '!begin t1\\n');
  fs.readFileSync(${JSON.stringify(data)});
  fs.appendFileSync(process.env.FSTRACE_OUT, '!end t1\\n');
  console.log('worker says "hello"');
  process.exit(7);
`;
const child = spawn(
  tracer,
  ['trace', log, [process.execPath, '-e', workerCode].map(quote).join(' ')],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FSTRACE_OUT: log },
    detached: true,
    windowsHide: true,
  }
);
let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (out += d));
child.on('exit', (code) => {
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const b = lines.indexOf('!begin t1'),
    e = lines.indexOf('!end t1');
  const inCall = lines.slice(b + 1, e).map((l) => l.toLowerCase());
  console.log({
    exitCode: code,
    stdout: out.trim(),
    markers: b >= 0 && e > b,
    dataReadInCall: inCall.includes(data.toLowerCase()),
    readsBeforeCall: b,
  });
});
