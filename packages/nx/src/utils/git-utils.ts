import {
  ExecFileOptions,
  execFile,
  execFileSync,
  execSync,
} from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { dirname, join, posix, relative, sep } from 'path';
import { logger } from './logger';

function execFileAsync(
  file: string,
  args: string[],
  execOptions: ExecFileOptions
) {
  return new Promise<string>((res, rej) => {
    execFile(
      file,
      args,
      { ...execOptions, windowsHide: true },
      (err, stdout) => {
        if (err) {
          return rej(err);
        }
        res(stdout.toString());
      }
    );
  });
}

export async function cloneFromUpstream(
  url: string,
  destination: string,
  { originName, depth }: { originName: string; depth?: number } = {
    originName: 'origin',
  }
) {
  await execFileAsync(
    'git',
    [
      'clone',
      url,
      destination,
      ...(depth ? ['--depth', `${depth}`] : []),
      '--origin',
      originName,
    ],
    {
      cwd: dirname(destination),
      maxBuffer: 10 * 1024 * 1024,
    }
  );

  return new GitRepository(destination);
}

export class GitRepository {
  public root = this.getGitRootPath(this.directory);
  constructor(private directory: string) {}

  getGitRootPath(cwd: string) {
    return getGitRootPath(cwd);
  }

  async hasUncommittedChanges() {
    const data = await this.execGit(['status', '--porcelain']);
    return data.trim() !== '';
  }

  async addFetchRemote(remoteName: string, branch: string) {
    return await this.execGit([
      'config',
      '--add',
      `remote.${remoteName}.fetch`,
      `+refs/heads/${branch}:refs/remotes/${remoteName}/${branch}`,
    ]);
  }

  async showStat() {
    return await this.execGit(['show', '--stat']);
  }

  async listBranches() {
    return (await this.execGit(['ls-remote', '--heads', '--quiet']))
      .trim()
      .split('\n')
      .map((s) =>
        s
          .trim()
          .substring(s.indexOf('\t') + 1)
          .replace('refs/heads/', '')
      );
  }

  async getGitFiles(path: string) {
    // Use -z to return file names exactly as they are stored in git, separated by NULL (\x00) character.
    // This avoids problems with special characters in file names.
    return (await this.execGit(['ls-files', '-z', '--', path]))
      .trim()
      .split('\x00')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async reset(ref: string) {
    return await this.execGit(['reset', '--hard', ref]);
  }

  async mergeUnrelatedHistories(ref: string, message: string) {
    return await this.execGit([
      'merge',
      ref,
      '-X',
      'ours',
      '--allow-unrelated-histories',
      '-m',
      message,
    ]);
  }
  async fetch(remote: string, ref?: string) {
    return await this.execGit(['fetch', remote, ...(ref ? [ref] : [])]);
  }

  async checkout(
    branch: string,
    opts: {
      new: boolean;
      base: string;
    }
  ) {
    return await this.execGit([
      'checkout',
      ...(opts.new ? ['-b'] : []),
      branch,
      ...(opts.base ? [opts.base] : []),
    ]);
  }

  async move(path: string, destination: string) {
    return await this.execGit(['mv', '--', path, destination]);
  }

  async push(ref: string, remoteName: string) {
    return await this.execGit(['push', '-u', '-f', remoteName, ref]);
  }

  async commit(message: string) {
    return await this.execGit(['commit', '-am', message]);
  }
  async amendCommit() {
    return await this.execGit(['commit', '--amend', '-a', '--no-edit']);
  }

  async deleteGitRemote(name: string) {
    return await this.execGit(['remote', 'rm', name]);
  }

  async addGitRemote(name: string, url: string) {
    return await this.execGit(['remote', 'add', name, url]);
  }

  async hasFilterRepoInstalled() {
    try {
      await this.execGit(['filter-repo', '--help']);
      return true;
    } catch {
      return false;
    }
  }

  // git-filter-repo is much faster than filter-branch, but needs to be installed by user
  // Use `hasFilterRepoInstalled` to check if it's installed
  async filterRepo(source: string, destination: string) {
    // NOTE: filter-repo requires POSIX path to work
    const sourcePosixPath = source.split(sep).join(posix.sep);
    const destinationPosixPath = destination.split(sep).join(posix.sep);
    const sourcePath = ensureTrailingSlash(sourcePosixPath);
    const destinationPath = ensureTrailingSlash(destinationPosixPath);
    await this.execGit([
      'filter-repo',
      '-f',
      ...(source !== '' ? ['--path', sourcePosixPath] : []),
      ...(source !== destination
        ? ['--path-rename', `${sourcePath}:${destinationPath}`]
        : []),
    ]);
  }

  async filterBranch(source: string, destination: string, branchName: string) {
    // We need non-ASCII file names to not be quoted, or else filter-branch will exclude them.
    await this.execGit(['config', 'core.quotepath', 'false']);
    // NOTE: filter-repo requires POSIX path to work
    const sourcePosixPath = source.split(sep).join(posix.sep);
    const destinationPosixPath = destination.split(sep).join(posix.sep);
    // First, if the source is not a root project, then only include commits relevant to the subdirectory.
    if (source !== '') {
      const indexFilterCommand = `node ${quoteForShell(
        join(__dirname, 'git-utils.index-filter.js')
      )}`;
      await this.execGit(
        [
          'filter-branch',
          '-f',
          '--index-filter',
          indexFilterCommand,
          '--prune-empty',
          '--',
          branchName,
        ],
        {
          NX_IMPORT_SOURCE: sourcePosixPath,
          NX_IMPORT_DESTINATION: destinationPosixPath,
        }
      );
    }
    // Then, move files to their new location if necessary.
    if (source === '' || source !== destination) {
      const treeFilterCommand = `node ${quoteForShell(
        join(__dirname, 'git-utils.tree-filter.js')
      )}`;
      await this.execGit(
        [
          'filter-branch',
          '-f',
          '--tree-filter',
          treeFilterCommand,
          '--',
          branchName,
        ],
        {
          NX_IMPORT_SOURCE: sourcePosixPath,
          NX_IMPORT_DESTINATION: destinationPosixPath,
        }
      );
    }
  }

  private execGit(args: string[], env?: Record<string, string>) {
    return execFileAsync('git', args, {
      cwd: this.root,
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        ...env,
      },
    });
  }
}

function ensureTrailingSlash(path: string) {
  return path !== '' && !path.endsWith('/') ? `${path}/` : path;
}

function quoteForShell(arg: string) {
  return `'${arg.replaceAll("'", "'\"'\"'")}'`;
}

export interface VcsRemoteInfo {
  domain: string;
  slug: string;
}

export function parseVcsRemoteUrl(url: string): VcsRemoteInfo | null {
  // Remove whitespace and handle common URL formats
  const cleanUrl = url.trim();

  // SSH format: git@domain:owner/repo.git
  const sshMatch = cleanUrl.match(/^git@([^:]+):([^\/]+)\/(.+?)(\.git)?$/);
  if (sshMatch) {
    const [, domain, owner, repo] = sshMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // HTTPS with authentication: https://user@domain/owner/repo.git
  const httpsAuthMatch = cleanUrl.match(
    /^https?:\/\/[^@]+@([^\/]+)\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (httpsAuthMatch) {
    const [, domain, owner, repo] = httpsAuthMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // HTTPS format: https://domain/owner/repo.git (without authentication)
  const httpsMatch = cleanUrl.match(
    /^https?:\/\/([^@\/]+)\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (httpsMatch) {
    const [, domain, owner, repo] = httpsMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  // SSH alternative format: ssh://git@domain/owner/repo.git or ssh://git@domain:port/owner/repo.git
  const sshAltMatch = cleanUrl.match(
    /^ssh:\/\/[^@]+@([^:\/]+)(:[0-9]+)?\/([^\/]+)\/(.+?)(\.git)?$/
  );
  if (sshAltMatch) {
    const [, domain, , owner, repo] = sshAltMatch;
    return {
      domain,
      slug: `${owner}/${repo}`,
    };
  }

  return null;
}

export function getVcsRemoteInfo(directory?: string): VcsRemoteInfo | null {
  try {
    const gitRemote = execSync('git remote -v', {
      stdio: 'pipe',
      windowsHide: true,
      cwd: directory,
    })
      .toString()
      .trim();

    if (!gitRemote || gitRemote.length === 0) {
      return null;
    }

    const lines = gitRemote.split('\n').filter((line) => line.trim());
    const remotesPriority = ['origin', 'upstream', 'base'];
    const foundRemotes: { [key: string]: VcsRemoteInfo } = {};
    let firstRemote: VcsRemoteInfo | null = null;

    for (const line of lines) {
      const match = line.trim().match(/^(\w+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (match) {
        const [, remoteName, url] = match;
        const remoteInfo = parseVcsRemoteUrl(url);

        if (remoteInfo && !foundRemotes[remoteName]) {
          foundRemotes[remoteName] = remoteInfo;

          if (!firstRemote) {
            firstRemote = remoteInfo;
          }
        }
      }
    }

    // Return high-priority remote if found
    for (const remote of remotesPriority) {
      if (foundRemotes[remote]) {
        return foundRemotes[remote];
      }
    }

    // Return first found remote
    return firstRemote;
  } catch (e) {
    return null;
  }
}

export function getGitRootPath(cwd?: string): string {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd,
    windowsHide: true,
  })
    .toString()
    .trim();
}

/**
 * Path of `directory` relative to its git root, posix-separated so it is
 * identical on every OS, and '' when the directory is the git root itself.
 * Null outside a git repository.
 */
export function getGitRootRelativePath(directory: string): string | null {
  try {
    return relative(getGitRootPath(directory), directory)
      .split(sep)
      .join(posix.sep);
  } catch {
    return null;
  }
}

/** A shallow clone's truncated history has no stable root commit. */
export function isShallowRepository(directory?: string): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        encoding: 'utf8',
        stdio: 'pipe',
        cwd: directory,
        windowsHide: true,
      }).trim() === 'true'
    );
  } catch {
    return false;
  }
}

/**
 * SHA of the repository's first commit. Merged unrelated histories leave
 * several root commits — the sorted-first one is picked so every clone
 * agrees. Null when there are no commits, or outside a git repository.
 */
export function getFirstCommitSha(directory?: string): string | null {
  try {
    const roots = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: directory,
      windowsHide: true,
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    return roots.sort()[0] ?? null;
  } catch {
    return null;
  }
}

export function isGitRepository(directory?: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
      cwd: directory,
      windowsHide: true,
    });
    return true;
  } catch {
    return false;
  }
}

// Checked-out branch name, or null when there isn't one to act on: a detached
// HEAD reports the literal "HEAD" (treated as no branch), and any git error
// (not a repo, no commits yet) also yields null.
export function getGitCurrentBranch(directory?: string): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf8',
      cwd: directory,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    }).trim();
    return branch && branch !== 'HEAD' ? branch : null;
  } catch {
    return null;
  }
}

// Sync companion to `GitRepository.hasUncommittedChanges` for callers that
// can't drop into the async class (e.g. the migrate orchestrator, which
// branches on this before spawning subprocesses synchronously).
export function hasUncommittedChanges(directory?: string): boolean {
  try {
    const out = execSync('git status --porcelain', {
      encoding: 'utf8',
      cwd: directory,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    return out.trim() !== '';
  } catch {
    return false;
  }
}

// Returns a content-sensitive sha1 snapshot of the working tree state for
// before/after comparison. Hashes three probes:
//   1. `git diff HEAD` with defensive flags — every byte of tracked-file
//      changes. `--no-ext-diff` / `--no-textconv` neuter user/repo driver
//      overrides so output is deterministic; `--binary` keeps binary
//      edits from collapsing to "Binary files differ".
//   2. `git status --porcelain=v1 -uall` — untracked paths the diff
//      omits. `-uall` expands untracked directories per-file.
//   3. Untracked file content bytes — so a same-path content edit on an
//      already-untracked file does not collapse against the baseline.
//
// Each probe is wrapped independently with a failure sentinel so a
// single-sided git error (e.g. `git diff HEAD` on an initial-commit-less
// repo) cannot mask surviving signal from the others.
export function getUncommittedChangesSnapshot(directory?: string): string {
  const hasher = crypto.createHash('sha1');
  const cwd = directory ?? process.cwd();
  const execOpts = {
    encoding: 'utf8' as const,
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  };

  let diffOutput: string;
  try {
    diffOutput = execSync(
      'git diff HEAD --no-color --no-ext-diff --no-textconv --binary',
      execOpts
    );
  } catch {
    diffOutput = '<diff-unavailable>';
  }
  hasher.update('diff:').update(diffOutput).update('\0');

  let statusOutput: string;
  try {
    statusOutput = execSync('git status --porcelain=v1 -uall', execOpts);
  } catch {
    statusOutput = '<status-unavailable>';
  }
  hasher.update('status:').update(statusOutput).update('\0');

  let untrackedRaw: string;
  try {
    untrackedRaw = execSync(
      'git ls-files --others --exclude-standard -z',
      execOpts
    );
  } catch {
    untrackedRaw = '';
  }
  const untrackedPaths = untrackedRaw.split('\0').filter(Boolean).sort();
  hasher.update('untracked:');
  for (const p of untrackedPaths) {
    hasher.update(p).update('\0');
    try {
      hasher.update(fs.readFileSync(join(cwd, p)));
    } catch {
      hasher.update('<file-unreadable>');
    }
    hasher.update('\0');
  }

  return hasher.digest('hex');
}

export function commitChanges(
  commitMessage: string,
  directory?: string
): string | null {
  try {
    execSync('git add -A', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: directory,
      windowsHide: true,
    });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
      cwd: directory,
      windowsHide: true,
    });
  } catch (err) {
    if (directory) {
      // We don't want to throw during create-nx-workspace
      // because maybe there was an error when setting up git
      // initially.
      logger.verbose(`Git may not be set up correctly for this new workspace.
        ${err}`);
    } else {
      throw new Error(`Error committing changes:\n${err.stderr}`);
    }
  }

  return getLatestCommitSha(directory);
}

/**
 * Throws on git failure with the real stderr attached. Use this when the
 * caller needs to distinguish hook rejection / GPG signing failures / LFS
 * lock errors from a successful no-op. Callers should pre-check
 * `hasUncommittedChanges` to avoid the "nothing to commit" rejection
 * (which `git commit` exits non-zero for).
 *
 * Returns `null` (rather than throwing) when the commit itself succeeded
 * but `git rev-parse HEAD` failed transiently — by contract the diff is
 * no longer in the working tree, so callers must NOT report it as such.
 */
export function tryCommitChanges(
  commitMessage: string,
  directory: string
): string | null {
  try {
    execSync('git add -A', {
      encoding: 'utf8',
      stdio: 'pipe',
      cwd: directory,
      windowsHide: true,
    });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
      cwd: directory,
      windowsHide: true,
    });
  } catch (err) {
    const stderr = (err as { stderr?: Buffer | string })?.stderr?.toString();
    const stdout = (err as { stdout?: Buffer | string })?.stdout?.toString();
    const detail = [stderr, stdout]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join('\n');
    // `{ cause }` preserves structured fields (.signal, .status, .code)
    // for callers to inspect; otherwise only stderr/stdout text survives.
    throw new Error(
      detail || (err instanceof Error ? err.message : String(err)),
      { cause: err }
    );
  }
  return getLatestCommitSha(directory);
}

export function getLatestCommitSha(directory?: string): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe',
      windowsHide: true,
      cwd: directory,
    }).trim();
  } catch {
    return null;
  }
}
