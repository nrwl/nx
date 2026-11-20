import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { GitRepository } from '../../../utils/git-utils';
import {
  createTemporaryRemote,
  mergeRemoteSource,
} from './merge-remote-source';

const remoteName = '__tmp_nx_import__';
const tempBranch = '__nx_tmp_import__/main';

function git(args: string[], cwd: string) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    windowsHide: true,
  });
}

function initRepo(dir: string) {
  mkdirSync(dir, { recursive: true });
  git(['init', '-b', 'main'], dir);
  git(['config', 'user.email', 'test@example.com'], dir);
  git(['config', 'user.name', 'Test User'], dir);
}

function commitFile(repo: string, file: string, message: string) {
  mkdirSync(dirname(join(repo, file)), { recursive: true });
  writeFileSync(join(repo, file), message);
  git(['add', '--', file], repo);
  git(['commit', '-m', message], repo);
}

describe('mergeRemoteSource', () => {
  let root: string;
  let source: string;
  let destination: string;

  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-import-merge-')));
    source = join(root, 'source');
    destination = join(root, 'destination');

    initRepo(destination);
    commitFile(destination, 'README.md', 'destination');

    initRepo(source);
    commitFile(source, 'root-file.txt', 'unrelocated');
    git(['tag', `${remoteName}/${tempBranch}`], source);
    git(['checkout', '--orphan', tempBranch], source);
    git(['rm', '-rf', '--quiet', '.'], source);
    commitFile(source, 'libs/imported/file.txt', 'relocated');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('merges the temporary branch even when a source tag has the same short name', async () => {
    const destinationGitClient = new GitRepository(destination);

    await createTemporaryRemote(
      destinationGitClient,
      join(source, '.git'),
      remoteName
    );
    await mergeRemoteSource(
      destinationGitClient,
      source,
      tempBranch,
      'libs/imported',
      remoteName,
      'main'
    );

    expect(existsSync(join(destination, 'libs/imported/file.txt'))).toBe(true);
    expect(existsSync(join(destination, 'root-file.txt'))).toBe(false);
    expect(git(['tag', '--list'], destination).trim()).toBe('');
  });

  it('merges the remote-tracking branch when a destination tag shadows its short name', async () => {
    const destinationGitClient = new GitRepository(destination);
    git(
      ['fetch', '--no-tags', join(source, '.git'), 'refs/tags/*:refs/tags/*'],
      destination
    );

    await createTemporaryRemote(
      destinationGitClient,
      join(source, '.git'),
      remoteName
    );
    await mergeRemoteSource(
      destinationGitClient,
      source,
      tempBranch,
      'libs/imported',
      remoteName,
      'main'
    );

    expect(existsSync(join(destination, 'libs/imported/file.txt'))).toBe(true);
    expect(existsSync(join(destination, 'root-file.txt'))).toBe(false);
  });
});
