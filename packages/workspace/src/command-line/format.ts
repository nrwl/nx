import { execSync } from 'child_process';
import * as path from 'path';
import { getProjectRoots, parseFiles } from './shared';
import { fileExists } from '../utilities/fileutils';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
} from '../core/project-graph';
import { filterAffected } from '../core/affected-project-graph';
import { calculateFileChanges } from '../core/file-utils';
import * as yargs from 'yargs';
import { NxArgs, splitArgsIntoNxArgsAndOverrides } from './utils';
import {
  reformattedWorkspaceJsonOrNull,
  workspaceConfigName,
} from '@nrwl/tao/src/shared/workspace';
import { appRootPath } from '@nrwl/workspace/src/utilities/app-root';
import { readFileSync, writeFileSync } from 'fs-extra';
import * as stripJsonComments from 'strip-json-comments';
import * as prettier from 'prettier';

const PRETTIER_PATH = require.resolve('prettier/bin-prettier');

export function format(
  command: 'check' | 'write',
  args: yargs.Arguments
): void {
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(args, 'affected');

  const patterns = getPatterns({ ...args, ...nxArgs } as any).map(
    (p) => `"${p}"`
  );

  // Chunkify the patterns array to prevent crashing the windows terminal
  const chunkList: string[][] = chunkify(patterns, 50);

  switch (command) {
    case 'write':
      updateWorkspaceJsonToMatchFormatVersion();
      chunkList.forEach((chunk) => write(chunk));
      break;
    case 'check':
      chunkList.forEach((chunk) => check(chunk));
      break;
  }
}

function getPatterns(
  args: NxArgs & { libsAndApps: boolean; _: string[] }
): string[] {
  const supportedExtensions = prettier
    .getSupportInfo()
    .languages.flatMap((language) => language.extensions)
    .filter((extension) => !!extension);
  const matchAllPattern = `**/*{${supportedExtensions.join(',')}}`;
  const allFilesPattern = [matchAllPattern];

  try {
    if (args.all) {
      return allFilesPattern;
    }

    if (args.projects && args.projects.length > 0) {
      return getPatternsFromProjects(args.projects, matchAllPattern);
    }

    const p = parseFiles(args);
    const patterns = p.files
      .filter((f) => fileExists(f))
      .filter((f) => supportedExtensions.includes(path.extname(f)));

    return args.libsAndApps
      ? getPatternsFromApps(patterns, matchAllPattern)
      : patterns;
  } catch (e) {
    return allFilesPattern;
  }
}

function getPatternsFromApps(
  affectedFiles: string[],
  matchAllPattern: string
): string[] {
  const graph = onlyWorkspaceProjects(createProjectGraph());
  const affectedGraph = filterAffected(
    graph,
    calculateFileChanges(affectedFiles)
  );
  return getPatternsFromProjects(
    Object.keys(affectedGraph.nodes),
    matchAllPattern
  );
}

function getPatternsFromProjects(
  projects: string[],
  matchAllPattern: string
): string[] {
  const roots = getProjectRoots(projects);
  return roots.map((root) => `${root}/${matchAllPattern}`);
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
    execSync(`node "${PRETTIER_PATH}" --write ${patterns.join(' ')}`, {
      stdio: [0, 1, 2],
    });
  }
}

function check(patterns: string[]) {
  if (patterns.length > 0) {
    try {
      execSync(
        `node "${PRETTIER_PATH}" --list-different ${patterns.join(' ')}`,
        {
          stdio: [0, 1, 2],
        }
      );
    } catch (e) {
      process.exit(1);
    }
  }
}

function updateWorkspaceJsonToMatchFormatVersion() {
  try {
    const workspaceJson = JSON.parse(
      stripJsonComments(
        readFileSync(workspaceConfigName(appRootPath)).toString()
      )
    );
    const reformatted = reformattedWorkspaceJsonOrNull(workspaceJson);
    if (reformatted) {
      writeFileSync(
        workspaceConfigName(appRootPath),
        JSON.stringify(reformatted, null, 2)
      );
    }
  } catch (e) {
    console.error(`Failed to format: ${path}`);
    console.error(e);
  }
}
