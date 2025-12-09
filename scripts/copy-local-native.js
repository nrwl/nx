//@ts-check
const fs = require('fs');
const path = require('path');
const glob = require('tinyglobby');

const p = process.argv[2];

const nativeFiles = glob.globSync(`packages/${p}/**/*.{node,wasm,js,mjs,cjs}`, {
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    'src/command-line/migrate/run-migration-process.js',
  ],
});

console.log({ nativeFiles });

// Platform mapping for native packages
const platformMap = {
  'darwin-arm64': 'darwin-arm64',
  'darwin-x64': 'darwin-x64',
  'linux-x64-gnu': 'linux-x64-gnu',
  'linux-x64-musl': 'linux-x64-musl',
  'linux-arm64-gnu': 'linux-arm64-gnu',
  'linux-arm64-musl': 'linux-arm64-musl',
  'linux-arm-gnueabihf': 'linux-arm-gnueabihf',
  'win32-x64-msvc': 'win32-x64-msvc',
  'win32-arm64-msvc': 'win32-arm64-msvc',
  'freebsd-x64': 'freebsd-x64',
};

nativeFiles.forEach((file) => {
  // Copy to LOCAL dist directory (packages/nx/dist/...)
  const relativePath = file.replace(`packages/${p}/`, '');
  const destFile = `packages/${p}/dist/${relativePath}`;
  const destDir = path.dirname(destFile);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(file, destFile);
  console.log(`Copied ${file} -> ${destFile}`);

  // For .node files, also copy to CENTRALIZED dist for native packages
  if (file.endsWith('.node')) {
    const fileName = path.basename(file);
    // Extract platform from filename: nx.darwin-arm64.node -> darwin-arm64
    const match = fileName.match(/^nx\.(.+)\.node$/);
    if (match) {
      const platform = match[1];
      if (platformMap[platform]) {
        // Native packages still publish from dist/packages/{platform}/
        const nativePackageDir = `dist/packages/${platform}`;
        const nativePackageDest = `${nativePackageDir}/${fileName}`;
        fs.mkdirSync(nativePackageDir, { recursive: true });
        fs.copyFileSync(file, nativePackageDest);
        console.log(`Copied ${file} -> ${nativePackageDest}`);
      }
    }
  }
});
