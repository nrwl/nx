import { execSync } from 'child_process';
import * as path from 'path';
import * as resolve from 'resolve';
import { getAffectedApps, getAppRoots, parseFiles } from './shared';

export function format(args: string[]) {
  const command = args[0];
  let patterns: string[];
  let rest: string[];

  try {
    if (args.length === 1) {
      patterns = ['"{apps,libs}/**/*.ts"'];
      rest = [];
    } else {
      const p = parseFiles(args.slice(1));
      patterns = p.files.filter(f => path.extname(f) === '.ts');
      rest = p.rest;

      const libsAndApp = rest.filter(a => a.startsWith('--libs-and-apps'))[0];
      if (libsAndApp) {
        patterns = getPatternsFromApps(patterns);
      }
    }
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'write':
      writePrettierLines(patterns);
      break;
    case 'check':
      checkPrettierLines(patterns);
      break;
  }
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

function printError(command: string, e: any) {
  console.error(`Pass the SHA range, as follows: npm run format:${command} -- SHA1 SHA2.`);
  console.error(
    `Or pass the list of files, as follows: npm run format:${command} --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
  console.error(e.message);
}

function write(patterns: string[]) {
  if (patterns.length > 0) {
    execSync(`node ${prettierPath()} --single-quote --print-width 120 --write ${patterns.join(' ')}`, {
      stdio: [0, 1, 2]
    });
  }
}

function check(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      execSync(`node ${prettierPath()} --single-quote --print-width 120 --list-different ${patterns.join(' ')}`, {
        stdio: [0, 1, 2]
      });
    } catch (e) {
      process.exit(1);
    }
  }
}

function prettierPath() {
  return `${path.dirname(resolve.sync('prettier', { basedir: __dirname }))}/bin-prettier.js`;
}


function writePrettierLines(patterns: string[]) {
  if (patterns.length > 0) {
    let cmd = `node ${prettierLinesPath()}`;
    patterns.forEach(pattern => {
      cmd += ` --whitelist="${pattern}"`;
    });
    execSync(cmd, {
      stdio: [0, 1, 2]
    });
  }
}

function checkPrettierLines(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      let cmd = `node ${prettierLinesPath()} --check-only`;
      patterns.forEach(pattern => {
        cmd += ` --whitelist="${pattern}"`;
      });
      execSync(cmd, {
        stdio: [0, 1, 2]
      });
    } catch (e) {
      process.exit(1);
    }
  }
}

function prettierLinesPath() {
  return `${path.dirname(resolve.sync('prettier-lines', { basedir: __dirname }))}/bin/prettier-lines.js`;
}
