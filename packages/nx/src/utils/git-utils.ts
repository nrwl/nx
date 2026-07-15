import {
  ExecFileOptions,
  execFile,
  execFileSync,
  execSync,
} from 'child_process';
import { dirname, join, posix, sep } from 'path';
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
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      windowsHide: true,
    })
      .toString()
      .trim();
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
