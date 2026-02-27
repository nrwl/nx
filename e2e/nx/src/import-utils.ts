import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'node:child_process';
import { join } from 'path';

/**
 * Initialize a directory as a git repo on branch `main`.
 */
function initGitRepo(repoPath: string): void {
  execSync(`git init`, { cwd: repoPath });
  execSync(`git add .`, { cwd: repoPath });
  execSync(`git commit -m "initial commit"`, { cwd: repoPath });
  try {
    execSync(`git checkout -b main`, { cwd: repoPath });
  } catch {
    // Already on main
  }
}

/**
 * Create a simple git repo with a README and package.json.
 */
export function createSimpleRepo(root: string, name: string): string {
  const repoPath = join(root, name);
  mkdirSync(repoPath, { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), `# ${name}`);
  writeFileSync(
    join(repoPath, 'package.json'),
    JSON.stringify({ name, version: '1.0.0' }, null, 2)
  );
  initGitRepo(repoPath);
  return repoPath;
}

/**
 * Create a git repo with two packages: packages/a and packages/b.
 */
export function createMultiPackageRepo(root: string): string {
  const repoPath = join(root, 'multi-pkg');
  mkdirSync(repoPath, { recursive: true });
  writeFileSync(join(repoPath, 'README.md'), '# Repo');
  initGitRepo(repoPath);

  mkdirSync(join(repoPath, 'packages/a'), { recursive: true });
  writeFileSync(join(repoPath, 'packages/a/README.md'), '# A');
  writeFileSync(
    join(repoPath, 'packages/a/package.json'),
    JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
  );
  execSync(`git add . && git commit -m "add package a"`, { cwd: repoPath });

  mkdirSync(join(repoPath, 'packages/b'), { recursive: true });
  writeFileSync(join(repoPath, 'packages/b/README.md'), '# B');
  writeFileSync(
    join(repoPath, 'packages/b/package.json'),
    JSON.stringify({ name: 'pkg-b', version: '1.0.0' }, null, 2)
  );
  execSync(`git add . && git commit -m "add package b"`, { cwd: repoPath });

  return repoPath;
}

/**
 * Parse NDJSON output from agent-mode nx commands.
 */
export function parseNdjsonOutput(stdout: string): Record<string, any>[] {
  return stdout
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed.startsWith('---') || trimmed.startsWith('[DISPLAY]'))
        return false;
      return trimmed.startsWith('{');
    })
    .map((line) => {
      try {
        return JSON.parse(line.trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Find first message matching a predicate in parsed NDJSON output.
 */
export function findMessage(
  messages: Record<string, any>[],
  predicate: (msg: Record<string, any>) => boolean
): Record<string, any> | undefined {
  return messages.find(predicate);
}
