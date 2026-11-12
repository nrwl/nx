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
  'C, static CRT (arm64)': [`openloop.exe ${d('c')} 1`, 'c'],
  'C, x64 under emulation': [`openloop-x64.exe ${d('c-x64')} 1`, 'c-x64'],
  'node -> C x64 child': [
    `${node} -e "require('child_process').execFileSync('openloop-x64.exe', [String.raw\`${d('c-x64-child')}\`, '1'])"`,
    'c-x64-child',
  ],
  'Go binary': [`readfile-go.exe ${d('go')}`, 'go'],
  'node sync fs': [
    `${node} -e "require('fs').readFileSync('${q(d('node-sync'))}')"`,
    'node-sync',
  ],
  'node async fs': [
    `${node} -e "require('fs').promises.readFile('${q(d('node-async'))}')"`,
    'node-async',
  ],
  'node -> spawn node (no shell)': [
    `${node} -e "require('child_process').execFileSync(process.execPath, ['-e', 'require(\\'fs\\').readFileSync(\\'${q(q(d('node-child')))}\\')'])"`,
    'node-child',
  ],
  'node -> execSync node (via cmd.exe)': [
    `${node} -e "require('child_process').execSync(JSON.stringify(process.execPath) + ' -e \\"require(\\'fs\\').readFileSync(\\'${q(q(d('node-shell')))}\\')\\"')"`,
    'node-shell',
  ],
  'cmd /c type': [`cmd /c type ${d('cmd-type')} >nul`, 'cmd-type'],
  'cmd -> cmd -> type': [`cmd /c cmd /c type ${d('cmd-cmd')} >nul`, 'cmd-cmd'],
  'powershell Get-Content': [
    `powershell -NoProfile -Command "Get-Content ${d('pwsh')} | Out-Null"`,
    'pwsh',
  ],
  'git hash-object': [`git hash-object ${d('git')}`, 'git'],
};

const rows = { node: { seen: process.arch } };
for (const [name, [cmdline, file]] of Object.entries(cases)) {
  const r = spawnSync(path.join(here, 'fstrace.exe'), ['trace', log, cmdline], {
    cwd: here,
    encoding: 'utf8',
    windowsVerbatimArguments: false,
  });
  const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
  const reads = new Set(lines.map((l) => l.toLowerCase()));
  rows[name] = {
    exit: r.status,
    seen: reads.has(d(file).toLowerCase()),
    events: lines.length,
    unique: reads.size,
    stderr: r.stderr.trim().slice(0, 60),
  };
}
const w = path.join(data, 'write-only.txt');
rmSync(w, { force: true });
spawnSync(
  path.join(here, 'fstrace.exe'),
  ['trace', log, `cmd /c echo x> ${w}`],
  { cwd: here }
);
rows['(write-only reported?)'] = {
  seen: readFileSync(log, 'utf8').toLowerCase().includes(w.toLowerCase()),
};
console.table(rows);
