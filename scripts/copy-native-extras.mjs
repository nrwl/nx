// `napi artifacts` moves only the .node bindings into the platform packages. This copies
// the other per-platform files from the downloaded CI artifacts, and fails when one is
// missing so a platform package is never published without a file it lists.
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [artifactsDir, npmDir] = process.argv.slice(2);
if (!artifactsDir || !npmDir) {
  console.error('usage: copy-native-extras.mjs <artifacts dir> <npm dir>');
  process.exit(2);
}

const extras = [
  {
    artifact: 'bindings-aarch64-apple-darwin',
    file: 'fstrace.darwin.dylib',
    pkg: 'darwin-arm64',
  },
  {
    artifact: 'bindings-x86_64-apple-darwin',
    file: 'fstrace.darwin.dylib',
    pkg: 'darwin-x64',
  },
];

for (const { artifact, file, pkg } of extras) {
  const from = join(artifactsDir, artifact, file);
  const to = join(npmDir, pkg, file);
  if (!existsSync(from)) {
    console.error(`Missing ${from}, which ${pkg} lists in its files.`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log(`${from} => ${to}`);
}
