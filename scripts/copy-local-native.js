//@ts-check
const fs = require('fs');
const glob = require('fast-glob');

const p = process.argv[2];

// Only copy the .node binaries when it is a local release
if (!process.env.LOCAL_RELEASE) {
  process.exit(0);
}

const nativeFiles = glob.sync(`packages/${p}/**/*.node`);

nativeFiles.forEach((file) => {
  fs.copyFileSync(file, `build/${file}`);
});
