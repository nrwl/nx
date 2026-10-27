import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function git(args: string[], cwd: string, env?: Record<string, string>) {
  return execFileSync('git', args, {
    cwd,
    env: { ...process.env, FILTER_BRANCH_SQUELCH_WARNING: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).toString();
}

(process.platform === 'win32' ? describe.skip : describe)(
  'git-utils.tree-filter',
  () => {
    let root: string;
    let repo: string;
    let outside: string;
    let filterScript: string;

    beforeEach(() => {
      root = realpathSync(mkdtempSync(join(tmpdir(), 'nx-tree-filter-')));
      repo = join(root, 'repo');
      outside = join(root, 'outside');
      mkdirSync(repo);
      mkdirSync(outside);
      filterScript = join(root, 'tree-filter.js');
      copyFileSync(join(__dirname, 'git-utils.tree-filter.ts'), filterScript);
      git(['init', '-b', 'main'], repo);
      git(['config', 'user.email', 'test@example.com'], repo);
      git(['config', 'user.name', 'Test User'], repo);
    });

    afterEach(() => {
      rmSync(root, { recursive: true, force: true });
    });

    function filter(source: string, destination: string) {
      git(
        [
          'filter-branch',
          '-f',
          '--tree-filter',
          `node ${JSON.stringify(filterScript)}`,
          '--',
          'main',
        ],
        repo,
        { NX_IMPORT_SOURCE: source, NX_IMPORT_DESTINATION: destination }
      );
    }

    function trackedFiles() {
      return git(['ls-tree', '-r', '--name-only', '-z', 'main'], repo)
        .split('\0')
        .filter(Boolean);
    }

    it('moves files into the destination', () => {
      mkdirSync(join(repo, 'src'));
      writeFileSync(join(repo, 'src/index.ts'), 'index');
      writeFileSync(join(repo, 'README.md'), 'readme');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('', 'libs/inventory');

      expect(trackedFiles().sort()).toEqual([
        'libs/inventory/README.md',
        'libs/inventory/src/index.ts',
      ]);
    });

    it('moves a sub-directory into the destination', () => {
      mkdirSync(join(repo, 'packages/a/src'), { recursive: true });
      writeFileSync(join(repo, 'packages/a/src/index.ts'), 'a');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('packages/a', 'libs/a');

      expect(trackedFiles()).toEqual(['libs/a/src/index.ts']);
    });

    it('moves a sub-directory to the repository root', () => {
      mkdirSync(join(repo, 'packages/a/src'), { recursive: true });
      writeFileSync(join(repo, 'packages/a/src/index.ts'), 'a');
      writeFileSync(join(repo, 'packages/a/package.json'), '{}');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('packages/a', '');

      expect(trackedFiles().sort()).toEqual(['package.json', 'src/index.ts']);
    });

    it('does not follow committed symlinks on the destination path', () => {
      symlinkSync(outside, join(repo, 'libs'));
      writeFileSync(join(repo, 'a.txt'), 'a');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('', 'libs/inventory');

      expect(existsSync(join(outside, 'inventory'))).toBe(false);
      expect(trackedFiles().sort()).toEqual([
        'libs/inventory/a.txt',
        'libs/inventory/libs',
      ]);
    });

    it('does not write into the git directory through committed symlinks', () => {
      symlinkSync('.', join(repo, 'libs'));
      symlinkSync('../../.git', join(repo, 'inventory'));
      writeFileSync(join(repo, 'config'), '[core]\n');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);
      const gitConfig = readFileSync(join(repo, '.git/config'), 'utf-8');

      filter('', 'libs/inventory');

      expect(readFileSync(join(repo, '.git/config'), 'utf-8')).toBe(gitConfig);
      expect(trackedFiles().sort()).toEqual([
        'libs/inventory/config',
        'libs/inventory/inventory',
        'libs/inventory/libs',
      ]);
    });

    it('does not follow a committed symlink at the destination itself', () => {
      mkdirSync(join(repo, 'libs'));
      symlinkSync(outside, join(repo, 'libs/inventory'));
      writeFileSync(join(repo, 'a.txt'), 'a');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('', 'libs/inventory');

      expect(existsSync(join(outside, 'a.txt'))).toBe(false);
      expect(trackedFiles().sort()).toEqual([
        'libs/inventory/a.txt',
        'libs/inventory/libs/inventory',
      ]);
    });

    it('keeps file names that start with white space relative to the clone', () => {
      const secret = join(outside, 'token');
      writeFileSync(secret, 'secret');
      const name = ` ${secret}`;
      mkdirSync(join(repo, ' ', outside), { recursive: true });
      writeFileSync(join(repo, name), 'decoy');
      git(['add', '-A'], repo);
      git(['commit', '-m', 'initial'], repo);

      filter('', 'libs/inventory');

      expect(readFileSync(secret, 'utf-8')).toBe('secret');
      expect(trackedFiles()).toEqual([`libs/inventory/${name}`]);
    });
  }
);
