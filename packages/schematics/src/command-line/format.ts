import { execSync } from 'child_process';
import * as path from 'path';
import * as resolve from 'resolve';
import { getProjectRoots, parseFiles } from './shared';
import { YargsAffectedOptions } from './affected';
import { getTouchedProjects } from './touched';
import { fileExists } from '../utils/fileutils';

export interface YargsFormatOptions extends YargsAffectedOptions {
  libsAndApps?: boolean;
}

const PRETTIER_EXTENSIONS = [
  'ts',
  'js',
  'scss',
  'less',
  'css',
  'html',
  'json',
  'md'
];

export function format(command: 'check' | 'write', args: YargsFormatOptions) {
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

function getPatterns(args: YargsAffectedOptions) {
  try {
    if (args.all) {
      return getPatternsWithPathPrefix(['{apps,libs,tools}']);
    }

    const p = parseFiles(args);
    let patterns = p.files
      .filter(f => fileExists(f))
      .filter(f =>
        PRETTIER_EXTENSIONS.map(ext => '.' + ext).includes(path.extname(f))
      );

    const libsAndApp = args.libsAndApps;
    return libsAndApp ? getPatternsFromApps(patterns) : patterns;
  } catch (e) {
    return getPatternsWithPathPrefix(['{apps,libs,tools}']);
  }
}

function getPatternsFromApps(affectedFiles: string[]): string[] {
  const roots = getProjectRoots(getTouchedProjects(affectedFiles));
  return getPatternsWithPathPrefix(roots);
}

function chunkify(target: string[], size: number): string[][] {
  return target.reduce((current: string[][], value: string, index: number) => {
    if (index % size === 0) current.push([]);
    current[current.length - 1].push(value);
    return current;
  }, []);
}

function getPatternsWithPathPrefix(prefixes: string[]): string[] {
  return prefixes.map(
    prefix => `"${prefix}/**/*.{${PRETTIER_EXTENSIONS.join(',')}}"`
  );
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
