// @ts-check
/**
 * Copy nx-completion binaries from CI artifacts into platform-specific npm packages.
 * Called as part of the publish pipeline, after `napi artifacts` has placed .node files.
 */
const fs = require('fs');
const path = require('path');

const platformMap = {
  'darwin-arm64': 'aarch64-apple-darwin',
  'darwin-x64': 'x86_64-apple-darwin',
  'linux-x64-gnu': 'x86_64-unknown-linux-gnu',
  'linux-x64-musl': 'x86_64-unknown-linux-musl',
  'linux-arm64-gnu': 'aarch64-unknown-linux-gnu',
  'linux-arm64-musl': 'aarch64-unknown-linux-musl',
  'linux-arm-gnueabihf': 'armv7-unknown-linux-gnueabihf',
  'freebsd-x64': 'x86_64-unknown-freebsd',
  'win32-x64-msvc': 'x86_64-pc-windows-msvc',
  'win32-arm64-msvc': 'aarch64-pc-windows-msvc',
};

for (const [pkgDir, target] of Object.entries(platformMap)) {
  const isWindows = pkgDir.startsWith('win32');
  const binName = `nx-completion-${target}${isWindows ? '.exe' : ''}`;
  const destName = isWindows ? 'nx-completion.exe' : 'nx-completion';

  const src = path.join(
    'artifacts',
    `bindings-${target}`,
    'packages',
    'nx',
    'src',
    'native',
    'completion-bin',
    binName
  );
  const dest = path.join('dist', 'packages', pkgDir, destName);

  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    if (!isWindows) {
      fs.chmodSync(dest, 0o755);
    }
    console.log(`Copied completion binary: ${pkgDir}`);
  } else {
    console.warn(`Completion binary not found for ${pkgDir}: ${src}`);
  }
}
