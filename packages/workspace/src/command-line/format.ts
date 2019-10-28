import { execSync } from 'child_process';
import * as path from 'path';
import * as resolve from 'resolve';
import { getProjectRoots, parseFiles, printArgsWarning } from './shared';
import { YargsAffectedOptions } from './run-tasks/affected';
import { getTouchedProjects } from './touched';
import { fileExists } from '../utils/fileutils';
import { output } from './output';

export interface YargsFormatOptions extends YargsAffectedOptions {
  libsAndApps?: boolean;
}

const PRETTIER_EXTENSIONS = [
  'ts',
  'js',
  'tsx',
  'jsx',
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
    output.error({
      title: e.message,
      bodyLines: [
        `Pass the SHA range: ${output.bold(
          `npm run format:${command} -- SHA1 SHA2`
        )}`,
        '',
        `Or pass the list of files: ${output.bold(
          `npm run format:${command} -- --files="libs/mylib/index.ts,libs/mylib2/index.ts"`
        )}`
      ]
    });
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
  const allFilesPattern = [`"**/*.{${PRETTIER_EXTENSIONS.join(',')}}"`];

  try {
    if (args.all) {
      return allFilesPattern;
    }

    printArgsWarning(args);
    const p = parseFiles(args);
    let patterns = p.files
      .filter(f => fileExists(f))
      .filter(f =>
        PRETTIER_EXTENSIONS.map(ext => '.' + ext).includes(path.extname(f))
      );

    const libsAndApp = args.libsAndApps;
    return libsAndApp
      ? getPatternsFromApps(patterns)
      : patterns.map(f => `"${f}"`);
  } catch (e) {
    return allFilesPattern;
  }
}

function getPatternsFromApps(affectedFiles: string[]): string[] {
  const roots = getProjectRoots(getTouchedProjects(affectedFiles));
  return roots.map(root => `"${root}/**/*.{${PRETTIER_EXTENSIONS.join(',')}}"`);
}

function chunkify(target: string[], size: number): string[][] {
  return target.reduce((current: string[][], value: string, index: number) => {
    if (index % size === 0) current.push([]);
    current[current.length - 1].push(value);
    return current;
  }, []);
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
