// `napi artifacts` moves only the .node bindings into the platform packages. This copies
// the file-read tracer files from the downloaded CI artifacts, and fails when one is
// missing so a platform package is never published without a file it lists.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [artifactsDir, npmDir] = process.argv.slice(2);
if (!artifactsDir || !npmDir) {
  console.error('usage: copy-native-extras.mjs <artifacts dir> <npm dir>');
  process.exit(2);
}

const windowsTracer = ['arm64', 'x64', 'x86'].flatMap((arch) => [
  `fstrace-${arch}.dll`,
  `fstrace-${arch}.exe`,
]);

// Rust target of the build job => platform package and the files it ships.
const extras = {
  'aarch64-apple-darwin': ['darwin-arm64', ['fstrace.darwin.dylib']],
  'x86_64-apple-darwin': ['darwin-x64', ['fstrace.darwin.dylib']],
  'x86_64-unknown-linux-gnu': ['linux-x64-gnu', ['fstrace.linux.so']],
  'x86_64-unknown-linux-musl': ['linux-x64-musl', ['fstrace.linux.so']],
  'aarch64-unknown-linux-gnu': ['linux-arm64-gnu', ['fstrace.linux.so']],
  'aarch64-unknown-linux-musl': ['linux-arm64-musl', ['fstrace.linux.so']],
  'armv7-unknown-linux-gnueabihf': [
    'linux-arm-gnueabihf',
    ['fstrace.linux.so'],
  ],
  'x86_64-pc-windows-msvc': ['win32-x64-msvc', windowsTracer],
  'aarch64-pc-windows-msvc': ['win32-arm64-msvc', windowsTracer],
};

let missing = false;
for (const [target, [pkg, files]] of Object.entries(extras)) {
  for (const file of files) {
    const from = join(artifactsDir, `bindings-${target}`, file);
    const to = join(npmDir, pkg, file);
    if (!existsSync(from)) {
      console.error(`Missing ${from}, which ${pkg} lists in its files.`);
      missing = true;
      continue;
    }
    copyFileSync(from, to);
    console.log(`${from} => ${to}`);
  }
}
process.exit(missing ? 1 : 0);
