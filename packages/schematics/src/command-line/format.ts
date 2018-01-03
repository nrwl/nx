import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const command = process.argv[2];
const files = parseFiles();

switch (command) {
  case 'write':
    write(files);
    break;
  case 'check':
    check(files);
    break;
}

function parseFiles(): string[] {
  const args = process.argv.slice(3);
  if (args.length === 0) {
    return ['"{apps,libs}/**/*.ts"'];
  }
  const dashDashFiles = args.filter(a => a.startsWith('--files='))[0];
  if (dashDashFiles) {
    args.splice(args.indexOf(dashDashFiles), 1);
    return parseDashDashFiles(dashDashFiles).map(t => `\"${t}\"`);
  } else {
    const withoutShahs = args.slice(2);
    return getFilesFromShash(args[0], args[1]).map(t => `\"${t}\"`);
  }
}

function parseDashDashFiles(dashDashFiles: string): string[] {
  let f = dashDashFiles.substring(8); // remove --files=
  if (f.startsWith('"') || f.startsWith("'")) {
    f = f.substring(1, f.length - 1);
  }
  return f.split(',').map(f => f.trim());
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return execSync(`git diff --name-only ${sha1} ${sha2}`)
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0)
    .filter(a => path.extname(a) === '.ts');
}

function write(files: string[]) {
  execSync(`node ./node_modules/prettier/bin/prettier.js --single-quote --print-width 120 --write ${files.join(' ')}`, {
    stdio: [0, 1, 2]
  });
}

function check(files: string[]) {
  try {
    execSync(
      `node ./node_modules/prettier/bin/prettier.js --single-quote --print-width 120 --list-different ${files.join(
        ' '
      )}`,
      {
        stdio: [0, 1, 2]
      }
    );
  } catch (e) {
    process.exit(1);
  }
}
