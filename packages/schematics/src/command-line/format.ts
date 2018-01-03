import { execSync } from 'child_process';
import * as path from 'path';
import { getAffectedApps, getAppRoots, parseFiles } from './shared';

const command = process.argv[2];
let patterns: string[];
let rest: string[];

try {
  if (process.argv.length === 3) {
    patterns = ['"{apps,libs}/**/*.ts"'];
    rest = [];
  } else {
    const p = parseFiles();
    patterns = p.files.filter(f => path.extname(f) === '.ts');
    rest = p.rest;

    const libsAndApp = rest.filter(a => a.startsWith('--libs-and-apps'))[0];
    if (libsAndApp) {
      patterns = getPatternsFromApps(patterns);
    }
  }
} catch (e) {
  printError(command);
}

switch (command) {
  case 'write':
    write(patterns);
    break;
  case 'check':
    check(patterns);
    break;
}

function getPatternsFromApps(affectedFiles: string[]): string[] {
  const roots = getAppRoots(getAffectedApps(affectedFiles));
  if (roots.length === 0) {
    return [];
  } else if (roots.length === 1) {
    return [`\"${roots[0]}/**/*.ts\"`];
  } else {
    return [`\"{${roots.join(',')}}/**/*.ts\"`];
  }
}

function printError(command: string) {
  console.error(`Pass the SHA range, as follows: npm run format:${command} SHA1 SHA2.`);
  console.error(
    `Or pass the list of files, as follows: npm run format:${command} --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
}

function write(patterns: string[]) {
  if (patterns.length > 0) {
    execSync(
      `node ./node_modules/prettier/bin/prettier.js --single-quote --print-width 120 --write ${patterns.join(' ')}`,
      {
        stdio: [0, 1, 2]
      }
    );
  }
}

function check(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      execSync(
        `node ./node_modules/prettier/bin/prettier.js --single-quote --print-width 120 --list-different ${patterns.join(
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
}
