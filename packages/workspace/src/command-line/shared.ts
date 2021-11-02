import { execSync } from 'child_process';
import { readWorkspaceJson, TEN_MEGABYTES } from '../core/file-utils';
import type { NxArgs } from './utils';

export function parseFiles(options: NxArgs): { files: string[] } {
  const { files, uncommitted, untracked, base, head } = options;

  if (files) {
    return {
      files,
    };
  } else if (uncommitted) {
    return {
      files: getUncommittedFiles(),
    };
  } else if (untracked) {
    return {
      files: getUntrackedFiles(),
    };
  } else if (base && head) {
    return {
      files: getFilesUsingBaseAndHead(base, head),
    };
  } else if (base) {
    return {
      files: Array.from(
        new Set([
          ...getFilesUsingBaseAndHead(base, 'HEAD'),
          ...getUncommittedFiles(),
          ...getUntrackedFiles(),
        ])
      ),
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
  let mergeBase: string;
  try {
    mergeBase = execSync(`git merge-base "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
    })
      .toString()
      .trim();
  } catch {
    mergeBase = execSync(`git merge-base --fork-point "${base}" "${head}"`, {
      maxBuffer: TEN_MEGABYTES,
    })
      .toString()
      .trim();
  }
  return parseGitOutput(
    `git diff --name-only --relative "${mergeBase}" "${head}"`
  );
}

function parseGitOutput(command: string): string[] {
  return execSync(command, { maxBuffer: TEN_MEGABYTES })
    .toString('utf-8')
    .split('\n')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

export function getProjectRoots(projectNames: string[]): string[] {
  const { projects } = readWorkspaceJson();
  return projectNames.map((name) => projects[name].root);
}
