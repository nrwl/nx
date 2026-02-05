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

nativeFiles.forEach((file) => {
  // Transform: packages/nx/src/native/file.js -> packages/nx/dist/src/native/file.js
  const parts = file.split('/');
  // Insert 'dist' after the package name (index 2)
  parts.splice(2, 0, 'dist');
  const destFile = parts.join('/');
  const destDir = path.dirname(destFile);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(file, destFile);
});
