import { execSync } from 'child_process';
import * as path from 'path';
import * as resolve from 'resolve';
import { getProjectRoots, getTouchedProjects, parseFiles } from './shared';

/*
* HTML formatting could be added here once Prettier supports it
* https://github.com/prettier/prettier/issues/1882
*/
const PRETTIER_EXTENSIONS = ['.ts', '.scss', '.css'];

export function format(args: string[]) {
  const command = args[0];
  let patterns: string[];

  try {
    patterns = getPatterns(args);
  } catch (e) {
    printError(command, e);
    process.exit(1);
  }

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns, 70);

  switch (command) {
    case 'write':
      chunkList.forEach(chunk => write(chunk));
      break;
    case 'check':
      chunkList.forEach(chunk => check(chunk));
      break;
  }
}

function getPatterns(args: string[]) {
  try {
    const p = parseFiles(args.slice(1));
    let patterns = p.files.filter(
      f => PRETTIER_EXTENSIONS.indexOf(path.extname(f)) > -1
    );
    let rest = p.rest;

    const libsAndApp = rest.filter(a => a.startsWith('--libs-and-apps'))[0];
    return libsAndApp ? getPatternsFromApps(patterns) : patterns;
  } catch (e) {
    return getPatternsWithPathPrefix('{apps,libs,tools}');
  }
}

function getPatternsFromApps(affectedFiles: string[]): string[] {
  const roots = getProjectRoots(getTouchedProjects(affectedFiles));
  if (roots.length === 0) {
    return [];
  } else if (roots.length === 1) {
    return getPatternsWithPathPrefix(roots[0]);
  } else {
    return getPatternsWithPathPrefix(roots.join(','));
  }
}

function chunkify(target: string[], size: number): string[][] {
  return target.reduce((current: string[][], value: string, index: number) => {
    if (index % size === 0) current.push([]);
    current[current.length - 1].push(value);
    return current;
  }, []);
}

function getPatternsWithPathPrefix(prefix: string): string[] {
  return PRETTIER_EXTENSIONS.map(extension => `"${prefix}/**/*${extension}"`);
}

function printError(command: string, e: any) {
  console.error(
    `Pass the SHA range, as follows: npm run format:${command} -- SHA1 SHA2.`
  );
  console.error(
    `Or pass the list of files, as follows: npm run format:${command} -- --files="libs/mylib/index.ts,libs/mylib2/index.ts".`
  );
  console.error(e.message);
}

function write(patterns: string[]) {
  if (patterns.length > 0) {
    execSync(`node "${prettierPath()}" --write ${patterns.join(' ')}`, {
      stdio: [0, 1, 2]
    });
  }
}

function check(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      execSync(
        `node "${prettierPath()}" --list-different ${patterns.join(' ')}`,
        {
          stdio: [0, 1, 2]
        }
      );
    } catch (e) {
      process.exit(1);
    }
  }
}

function prettierPath() {
  const basePath = path.dirname(
    resolve.sync('prettier', { basedir: __dirname })
  );
  return path.join(basePath, 'bin-prettier.js');
}
