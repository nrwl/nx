import { execSync } from 'child_process';
import { output } from '../utils/output';
import { createProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { NxJson } from '../core/shared-interfaces';
import { readWorkspaceJson, TEN_MEGABYTES } from '../core/file-utils';
import { NxArgs } from './utils';

export function printArgsWarning(options: NxArgs) {
  const { files, uncommitted, untracked, base, head, all } = options;

  if (!files && !uncommitted && !untracked && !base && !head && !all) {
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
    try {
      return {
        files: getFilesUsingBaseAndHead(base, head)
      };
    } catch (e) {
      if (e.message.includes('fatal: Not a valid object name')) {
        throw new Error(
          `Branch ${base} does not exist, check the branch and try again.`
        );
      }
    }
  } else if (base) {
    try {
      return {
        files: Array.from(
          new Set([
            ...getFilesUsingBaseAndHead(base, 'HEAD'),
            ...getUncommittedFiles(),
            ...getUntrackedFiles()
          ])
        )
      };
    } catch (e) {
      if (e.message.includes('fatal: Not a valid object name')) {
        throw new Error(
          `Branch ${base} does not exist, check the branch and try again.`
        );
      }
    }
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
