//@ts-check
const { mkdirSync, copySync } = require('fs-extra');
const glob = require('fast-glob');
const { join, basename } = require('path');

const p = process.argv[2];

const args = process.argv.slice(2);
const dest = args[args.length - 1];
const from = args.slice(0, args.length - 1);

try {
  mkdirSync(dest, {
    recursive: true,
  });
} catch {}
for (const f of from) {
  const matchingFiles = glob.sync(f, {
    cwd: process.cwd(),
    onlyDirectories: true,
  });

  console.log(f, matchingFiles);

  for (const file of matchingFiles) {
    const destFile = join(dest, basename(file));
    console.log(file, '=>', destFile);
    copySync(file, destFile);
  }
}
