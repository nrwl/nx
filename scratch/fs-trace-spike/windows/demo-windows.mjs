// Windows coverage check. Each case runs as its own traced tree.
import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
// Built by scripts/build-fstrace-shim.mjs. Point FSTRACE_BIN at a copy when running
// from outside the repo.
const tracer = path.join(
  process.env.FSTRACE_BIN ??
    path.resolve(here, '../../../packages/nx/src/native'),
  `fstrace-${process.arch}.exe`
);
const data = path.join(here, 'data');
mkdirSync(data, { recursive: true });
const d = (n) => {
  const p = path.join(data, `${n}.txt`);
  if (!existsSync(p)) writeFileSync(p, n);
  return p;
};
const node = `"${process.execPath}"`;
const q = (s) => s.replaceAll('\\', '\\\\');
const log = path.join(here, 'trace.log');

const cases = {
  'C, static CRT (arm64)': [`openloop-arm64.exe ${d('c')} 1`, 'c'],
  'C, x64 under emulation': [`openloop-x64.exe ${d('c-x64')} 1`, 'c-x64'],
  'C, x86 under WOW64': [`openloop-x86.exe ${d('c-x86')} 1`, 'c-x86'],
  'node -> C x64 child': [
    `${node} -e "require('child_process').execFileSync('openloop-x64.exe', [String.raw\`${d('c-x64-child')}\`, '1'])"`,
    'c-x64-child',
  ],
  'node -> C x86 child': [
    `${node} -e "require('child_process').execFileSync('openloop-x86.exe', [String.raw\`${d('c-x86-child')}\`, '1'])"`,
    'c-x86-child',
  ],
  'Go binary': [`readfile-go.exe ${d('go')}`, 'go'],
  'node sync fs': [
    `${node} -e "require('fs').readFileSync('${q(d('node-sync'))}')"`,
    'node-sync',
  ],
  'node -> spawn node (no shell)': [
    `${node} -e "require('child_process').execFileSync(process.execPath, ['-e', 'require(\\'fs\\').readFileSync(\\'${q(q(d('node-child')))}\\')'])"`,
    'node-child',
  ],
  'node -> execSync node (via cmd.exe)': [
    `${node} -e "require('child_process').execSync(JSON.stringify(process.execPath) + ' -e \\"require(\\'fs\\').readFileSync(\\'${q(q(d('node-shell')))}\\')\\"')"`,
    'node-shell',
  ],
  'cmd -> cmd -> type': [`cmd /c cmd /c type ${d('cmd-cmd')} >nul`, 'cmd-cmd'],
  'powershell Get-Content': [
    `powershell -NoProfile -Command "Get-Content ${d('pwsh')} | Out-Null"`,
    'pwsh',
  ],
  'git hash-object (x64 git)': [`git hash-object ${d('git')}`, 'git'],
};

const rows = { node: { seen: process.arch } };
for (const [name, [cmdline, file]] of Object.entries(cases)) {
  const r = spawnSync(tracer, ['trace', log, cmdline], {
    cwd: here,
    encoding: 'utf8',
    windowsVerbatimArguments: false,
  });
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const reads = new Set(lines.map((l) => l.toLowerCase()));
  const untraced = lines.filter((l) => l.startsWith('!untraced'));
  rows[name] = {
    untraced: untraced.length,
    exit: r.status,
    seen: reads.has(d(file).toLowerCase()),
    events: lines.length,
    unique: reads.size,
    stderr: r.stderr.trim().slice(0, 60),
  };
}
const w = path.join(data, 'write-only.txt');
rmSync(w, { force: true });
spawnSync(tracer, ['trace', log, `cmd /c echo x> ${w}`], { cwd: here });
rows['(write-only reported?)'] = {
  seen: readFileSync(log, 'utf8').toLowerCase().includes(w.toLowerCase()),
};
console.table(rows);
