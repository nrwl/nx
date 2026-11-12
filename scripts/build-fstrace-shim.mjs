// Builds the file-read tracing shim for this host's platform into packages/nx/src/native.
// macOS: one dylib with every slice a traced process tree can need, because an inserted
// library dyld cannot load kills the process. arm64 for native programs, arm64e for
// re-signed copies of Apple's binaries, x86_64 for Intel Macs and Rosetta.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const nativeDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/nx/src/native'
);

if (process.platform !== 'darwin') {
  console.log(`No file-read tracing shim for ${process.platform} yet.`);
  process.exit(0);
}

// The publish workflow sets CC and an explicit sysroot after removing the Command Line
// Tools SDKs, so both come from the environment when present.
const cc =
  process.env.CC ||
  execFileSync('xcrun', ['-f', 'clang'], { encoding: 'utf8' }).trim();
const sysroot = execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], {
  encoding: 'utf8',
}).trim();

execFileSync(
  cc,
  [
    '-O2',
    '-Wall',
    '-Wextra',
    '-Werror',
    '-isysroot',
    sysroot,
    '-mmacosx-version-min=11.0',
    '-arch',
    'arm64',
    '-arch',
    'arm64e',
    '-arch',
    'x86_64',
    '-dynamiclib',
    '-o',
    join(nativeDir, 'fstrace.darwin.dylib'),
    join(nativeDir, 'fstrace/macos.c'),
  ],
  { stdio: 'inherit' }
);
