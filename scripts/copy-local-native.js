//@ts-check
const fs = require('fs');
const path = require('path');
const glob = require('tinyglobby');

const p = process.argv[2];

const nativeFiles = glob.globSync(`packages/${p}/**/*.{node,wasm,js,mjs,cjs}`);

console.log({ nativeFiles });

nativeFiles.forEach((file) => {
  const targetFile = `build/${file}`;
  const targetDir = path.dirname(targetFile);

  // Ensure target directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  fs.copyFileSync(file, targetFile);
});
