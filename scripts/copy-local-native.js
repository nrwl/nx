//@ts-check
const fs = require('fs');
const path = require('path');
const glob = require('tinyglobby');

const p = process.argv[2];

const nativeFiles = glob.globSync(`packages/${p}/**/*.{node,wasm,js,mjs,cjs}`);

console.log(JSON.stringify({ nativeFiles }, null, 2));

nativeFiles.forEach((file) => {
  const destFile = `dist/${file}`;
  const destDir = path.dirname(destFile);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(file, destFile);
});
