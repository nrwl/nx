import { execSync } from 'child_process';
import * as path from 'path';
import * as resolve from 'resolve';
import {getProjectRoots, getTouchedProjects, parseFiles} from './shared';

export function format(args: string[]) {
  const command = args[0];
  let patterns: string[];

  try {
    patterns = getPatterns(args);
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  switch (command) {
    case 'write':
      write(patterns);
      break;
    case 'check':
      check(patterns);
      break;
  }
}

function getPatterns(args: string[]) {
  try {
    const p = parseFiles(args.slice(1));
    let patterns = p.files.filter(f => path.extname(f) === '.ts');
    let rest = p.rest;

    const libsAndApp = rest.filter(a => a.startsWith('--libs-and-apps'))[0];
    return libsAndApp ? getPatternsFromApps(patterns) : patterns;
  } catch (e) {
    return ['"{apps,libs}/**/*.ts"'];
  }
}

function getPatternsFromApps(affectedFiles: string[]): string[] {
  const roots = getProjectRoots(getTouchedProjects(affectedFiles));
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
  console.error(`Or pass the list of files, as follows: npm run format:${command} -- --files="libs/mylib/index.ts,libs/mylib2/index.ts".`);
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
  const basePath = path.dirname(resolve.sync('prettier', { basedir: __dirname }));
  return path.join(basePath, 'bin-prettier.js');
}
