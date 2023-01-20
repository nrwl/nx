//@ts-check
const fs = require('fs');
const glob = require('fast-glob');

const p = process.argv[2];

if (process.env.LOCAL_RELEASE) {
  process.exit(0);
}

const nativeFiles = glob.sync(`packages/${p}/**/*.node`);

nativeFiles.forEach((file) => {
  fs.copyFileSync(file, `build/${file}`);
});
