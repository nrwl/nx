import { exec, ExecOptions, execSync } from 'child_process';
import { dirname, posix, sep } from 'path';
import { logger } from '../devkit-exports';

function execAsync(command: string, execOptions: ExecOptions) {
  return new Promise<string>((res, rej) => {
    exec(command, execOptions, (err, stdout, stderr) => {
      if (err) {
        return rej(err);
      }
      res(stdout);
    });
  });
}

export async function cloneFromUpstream(
  url: string,
  destination: string,
  { originName, depth }: { originName: string; depth?: number } = {
    originName: 'origin',
  }
) {
  await execAsync(
    `git clone ${url} ${destination} ${
      depth ? `--depth ${depth}` : ''
    } --origin ${originName}`,
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
    return execSync('git rev-parse --show-toplevel', {
      cwd,
    })
      .toString()
      .trim();
  }

  async addFetchRemote(remoteName: string, branch: string) {
    return await this.execAsync(
      `git config --add remote.${remoteName}.fetch "+refs/heads/${branch}:refs/remotes/${remoteName}/${branch}"`
    );
  }

  async showStat() {
    return await this.execAsync(`git show --stat`);
  }

  async listBranches() {
    return (await this.execAsync(`git ls-remote --heads --quiet`))
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
    return (await this.execAsync(`git ls-files -z ${path}`))
      .trim()
      .split('\x00')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async reset(ref: string) {
    return await this.execAsync(`git reset ${ref} --hard`);
  }

  async mergeUnrelatedHistories(ref: string, message: string) {
    return await this.execAsync(
      `git merge ${ref} -X ours --allow-unrelated-histories -m "${message}"`
    );
  }
  async fetch(remote: string, ref?: string) {
    return await this.execAsync(`git fetch ${remote}${ref ? ` ${ref}` : ''}`);
  }

  async checkout(
    branch: string,
    opts: {
      new: boolean;
      base: string;
    }
  ) {
    return await this.execAsync(
      `git checkout ${opts.new ? '-b ' : ' '}${branch}${
        opts.base ? ' ' + opts.base : ''
      }`
    );
  }

  async move(path: string, destination: string) {
    return await this.execAsync(
      `git mv ${this.quotePath(path)} ${this.quotePath(destination)}`
    );
  }

  async push(ref: string, remoteName: string) {
    return await this.execAsync(`git push -u -f ${remoteName} ${ref}`);
  }

  async commit(message: string) {
    return await this.execAsync(`git commit -am "${message}"`);
  }
  async amendCommit() {
    return await this.execAsync(`git commit --amend -a --no-edit`);
  }

  async deleteGitRemote(name: string) {
    return await this.execAsync(`git remote rm ${name}`);
  }

  async addGitRemote(name: string, url: string) {
    return await this.execAsync(`git remote add ${name} ${url}`);
  }

  async hasFilterRepoInstalled() {
    try {
      await this.execAsync(`git filter-repo --help`);
      return true;
    } catch {
      return false;
    }
  }

  // git-filter-repo is much faster than filter-branch, but needs to be installed by user
  // Use `hasFilterRepoInstalled` to check if it's installed
  async filterRepo(subdirectory: string) {
    // filter-repo requires POSIX path to work
    const posixPath = subdirectory.split(sep).join(posix.sep);
    return await this.execAsync(
      `git filter-repo -f --subdirectory-filter ${this.quotePath(posixPath)}`
    );
  }

  async filterBranch(subdirectory: string, branchName: string) {
    // filter-repo requires POSIX path to work
    const posixPath = subdirectory.split(sep).join(posix.sep);
    // We need non-ASCII file names to not be quoted, or else filter-branch will exclude them.
    await this.execAsync(`git config core.quotepath false`);
    return await this.execAsync(
      `git filter-branch --subdirectory-filter ${this.quotePath(
        posixPath
      )} -- ${branchName}`
    );
  }

  private execAsync(command: string) {
    return execAsync(command, {
      cwd: this.root,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  private quotePath(path: string) {
    return process.platform === 'win32'
      ? // Windows/CMD only understands double-quotes, single-quotes are treated as part of the file name
        // Bash and other shells will substitute `$` in file names with a variable value.
        `"${path}"`
      : // e.g. `git mv "$$file.txt" "libs/a/$$file.txt"` will not work since `$$` is swapped with the PID of the last process.
        // Using single-quotes prevents this substitution.
        `'${path}'`;
  }
}

/**
 * This is currently duplicated in Nx Console. Please let @MaxKless know if you make changes here.
 */
export function getGithubSlugOrNull(): string | null {
  try {
    const gitRemote = execSync('git remote -v', {
      stdio: 'pipe',
    }).toString();
    // If there are no remotes, we default to github
    if (!gitRemote || gitRemote.length === 0) {
      return 'github';
    }
    return extractUserAndRepoFromGitHubUrl(gitRemote);
  } catch (e) {
    // Probably git is not set up, so we default to github
    return 'github';
  }
}

export function extractUserAndRepoFromGitHubUrl(
  gitRemotes: string
): string | null {
  const regex =
    /^\s*(\w+)\s+(git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/gm;
  const remotesPriority = ['origin', 'upstream', 'base'];
  const foundRemotes: { [key: string]: string } = {};
  let firstGitHubUrl: string | null = null;
  let match;

  while ((match = regex.exec(gitRemotes)) !== null) {
    const remoteName = match[1];
    const url = match[2] + match[3] + '/' + match[4] + '.git';
    foundRemotes[remoteName] = url;

    if (!firstGitHubUrl) {
      firstGitHubUrl = url;
    }
  }

  for (const remote of remotesPriority) {
    if (foundRemotes[remote]) {
      return parseGitHubUrl(foundRemotes[remote]);
    }
  }

  return firstGitHubUrl ? parseGitHubUrl(firstGitHubUrl) : null;
}

function parseGitHubUrl(url: string): string | null {
  const sshPattern =
    /git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/;
  const httpsPattern =
    /https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git/;
  let match = url.match(sshPattern) || url.match(httpsPattern);

  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return null;
}

export function commitChanges(
  commitMessage: string,
  directory?: string
): string | null {
  try {
    execSync('git add -A', { encoding: 'utf8', stdio: 'pipe' });
    execSync('git commit --no-verify -F -', {
      encoding: 'utf8',
      stdio: 'pipe',
      input: commitMessage,
      cwd: directory,
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

  return getLatestCommitSha();
}

export function getLatestCommitSha(): string | null {
  try {
    return execSync('git rev-parse HEAD', {
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  } catch {
    return null;
  }
}
