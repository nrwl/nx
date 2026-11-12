// macOS: tracing across SIP-protected and hardened binaries, without and with the exec
// rewrite. Run with tsx so the nx directory guards load from source.
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { ensureSipCopyDir } from './sip/sip-copy-dir';

const here = __dirname;
const { traceSpawn } = require('./fstrace.node');
const shimPath = path.join(
  here,
  '../../packages/nx/src/native/fstrace.darwin.dylib'
);
const data = path.join(here, 'fixtures/data/sip');
mkdirSync(data, { recursive: true });
const d = (n: string) => {
  const p = path.join(data, `${n}.txt`);
  writeFileSync(p, n);
  return p;
};
const node = process.execPath;
const readJs = (file: string) =>
  `require('fs').readFileSync(${JSON.stringify(file)})`;
const script = (name: string, body: string) => {
  const p = path.join(data, name);
  writeFileSync(p, body);
  chmodSync(p, 0o755);
  return p;
};

const gradlewLike = script(
  'gradlew-like',
  `#!/bin/sh\nexec "${node}" -e "${readJs(d('shebang-sh')).replaceAll('"', '\\"')}"\n`
);
const envShebang = script(
  'env-node.js',
  `#!/usr/bin/env node\n${readJs(d('shebang-env'))}\n`
);
const dotnetShim = path.join(homedir(), '.local/share/mise/shims/dotnet');

type Case = [cmd: string, args: string[], seen: (reads: string[]) => boolean];
const has = (f: string) => (reads: string[]) => reads.includes(f);
// The root of a traced tree here is node, as it is for a plugin worker, so every case is
// started by node through the hooked spawn path.
const viaNode = (
  cmd: string,
  args: string[],
  seen: Case[2],
  opts = ''
): Case => [
  node,
  [
    '-e',
    `require('child_process').execFileSync(${JSON.stringify(cmd)}, ${JSON.stringify(args)}, { stdio: 'ignore'${opts} })`,
  ],
  seen,
];
const cases: Record<string, Case> = {
  'node -> /bin/sh -> cat': viaNode(
    '/bin/sh',
    ['-c', `cat ${d('sh-cat')}`],
    has(d('sh-cat'))
  ),
  'node -> /bin/sh -> sh -> cat': viaNode(
    '/bin/sh',
    ['-c', `sh -c "cat ${d('sh-sh-cat')}"`],
    has(d('sh-sh-cat'))
  ),
  'node -> execSync node (via /bin/sh)': [
    node,
    [
      '-e',
      `require('child_process').execSync(${JSON.stringify(`"${node}" -e "${readJs(d('exec-sync')).replaceAll('"', '\\"')}"`)})`,
    ],
    has(d('exec-sync')),
  ],
  'node -> /bin/cat': viaNode('/bin/cat', [d('exec-cat')], has(d('exec-cat'))),
  'node -> #!/bin/sh script (gradlew)': viaNode(
    gradlewLike,
    [],
    has(d('shebang-sh'))
  ),
  'node -> #!/usr/bin/env node script': viaNode(
    envShebang,
    [],
    has(d('shebang-env'))
  ),
  'node -> node with env: {}': viaNode(
    node,
    ['-e', readJs(d('scrubbed'))],
    has(d('scrubbed')),
    ', env: {}'
  ),
  'node -> mise shim -> dotnet': viaNode(dotnetShim, ['--version'], (r) =>
    r.some((p) => p.includes('/mise/installs/dotnet/'))
  ),
  'node -> /usr/bin/python3 (xcrun shim)': viaNode(
    '/usr/bin/python3',
    ['-c', `open(${JSON.stringify(d('py'))}).read()`],
    has(d('py'))
  ),
  'node -> sh -> sudo (setuid)': viaNode(
    '/bin/sh',
    ['-c', 'sudo -n true 2>/dev/null; true'],
    () => false
  ),
};

async function main() {
  const sipDir = ensureSipCopyDir();
  if (!sipDir) throw new Error('could not establish the SIP copy directory');
  console.log(`copies: ${sipDir}`);

  const rows: Record<string, Record<string, string>> = {};
  for (const [mode, dir] of [
    ['without rewrite', undefined],
    ['with rewrite', sipDir],
  ] as const) {
    if (dir) process.env.FSTRACE_SIP_DIR = dir;
    else delete process.env.FSTRACE_SIP_DIR;
    for (const [name, [cmd, args, seen]] of Object.entries(cases)) {
      const r = await traceSpawn(cmd, args, {
        backend: 'preload',
        shimPath,
        cwd: here,
      });
      const untraced = r.reads
        .filter((p: string) => p.includes('!untraced'))
        .map((p: string) => p.split('!untraced ')[1]);
      const cell = `${r.exitCode === 0 ? '' : `exit ${r.exitCode} `}${seen(r.reads) ? 'seen' : 'missed'}${untraced.length ? ` (untraced: ${untraced.join(', ')})` : ''}`;
      (rows[name] ??= {})[mode] = cell;
    }
  }
  console.table(rows);
}

main();
