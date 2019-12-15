import { execSync } from 'child_process';
import * as fs from 'fs';
import { output } from '../utils/output';
import { createProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { NxArgs } from './utils';
import { NxJson } from '../core/shared-interfaces';
import { readWorkspaceJson, TEN_MEGABYTES } from '../core/file-utils';

export function printArgsWarning(options: NxArgs) {
  const { files, uncommitted, untracked, base, head, all } = options;

  if (
    !files &&
    !uncommitted &&
    !untracked &&
    !base &&
    !head &&
    !all &&
    options._.length < 2
  ) {
    output.note({
      title: `Affected criteria defaulted to --base=${output.bold(
        'master'
      )} --head=${output.bold('HEAD')}`
    });
  }

  if (all) {
    output.warn({
      title: `Running affected:* commands with --all can result in very slow builds.`,
      bodyLines: [
        output.bold('--all') +
          ' is not meant to be used for any sizable project or to be used in CI.',
        '',
        output.colors.gray(
          'Learn more about checking only what is affected: '
        ) + 'https://nx.dev/guides/monorepo-affected.'
      ]
    });
  }
}

export function parseFiles(options: NxArgs): { files: string[] } {
  const { files, uncommitted, untracked, base, head } = options;

  if (files) {
    return {
      files
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles()
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles()
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head)
    };
  } else if (base) {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead(base, 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles()
        ])
      )
    };
  } else if (options._.length >= 2) {
    return {
      files: getFilesFromShash(options._[1], options._[2])
    };
  } else {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead('master', 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles()
        ])
      )
    };
  }
}

function getUncommittedFiles(): string[] {
  return parseGitOutput(`git diff --name-only --relative HEAD .`);
}

function getUntrackedFiles(): string[] {
  return parseGitOutput(`git ls-files --others --exclude-standard`);
}

function getFilesUsingBaseAndHead(base: string, head: string): string[] {
  const mergeBase = execSync(`git merge-base ${base} ${head}`, {
    maxBuffer: TEN_MEGABYTES
  })
    .toString()
    .trim();
  return parseGitOutput(`git diff --name-only --relative ${mergeBase} ${head}`);
}

function getFilesFromShash(sha1: string, sha2: string): string[] {
  return parseGitOutput(`git diff --name-only --relative ${sha1} ${sha2}`);
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES })
    .toString('utf-8')
    .split('\n')
    .map(a => a.trim())
    .filter(a => a.length > 0);
}

// TODO: remove it in Nx 10
export function getProjectNodes(
  workspaceJson: any,
  nxJson: NxJson
): ProjectGraphNode[] {
  const graph = createProjectGraph(workspaceJson, nxJson);
  return Object.values(graph.nodes);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const { projects } = readWorkspaceJson();
  return projectNames.map(name => projects[name].root);
}
