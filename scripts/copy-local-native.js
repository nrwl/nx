//@ts-check
const fs = require('fs');
const glob = require('fast-glob');

const p = process.argv[2];

const nativeFiles = glob.sync(`packages/${p}/**/*.node`);

nativeFiles.forEach((file) => {
  console.log('COPY', file, '=>', `build/${file}`);
  fs.copyFileSync(file, `build/${file}`);
});
