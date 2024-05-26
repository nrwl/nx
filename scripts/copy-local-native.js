//@ts-check
const fs = require('fs');
const glob = require('fast-glob');

const p = process.argv[2];

const nativeFiles = glob.sync(`packages/${p}/**/*.{node,wasm}`);

console.log({ nativeFiles });

nativeFiles.forEach((file) => {
  fs.copyFileSync(file, `build/${file}`);
});
