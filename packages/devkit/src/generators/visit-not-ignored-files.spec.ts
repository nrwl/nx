import { execSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';
import { visitNotIgnoredFiles } from './visit-not-ignored-files';

describe('visitNotIgnoredFiles', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should visit files recursively in a directory', () => {
    tree.write('dir/file1.ts', '');
    tree.write('dir/dir2/file2.ts', '');

    const visitor = jest.fn();
    visitNotIgnoredFiles(tree, 'dir', visitor);

    expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
    expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
  });

  it('should not visit ignored files in a directory', () => {
    tree.write('.gitignore', 'node_modules');

    tree.write('dir/file1.ts', '');
    tree.write('dir/node_modules/file1.ts', '');
    tree.write('dir/dir2/file2.ts', '');

    const visitor = jest.fn();
    visitNotIgnoredFiles(tree, 'dir', visitor);

    expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
    expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
    expect(visitor).not.toHaveBeenCalledWith('dir/node_modules/file1.ts');
  });

  it.each(['', '.', '/', './'])(
    'should be able to visit the root path "%s"',
    (dirPath) => {
      tree.write('.gitignore', 'node_modules');

      tree.write('dir/file1.ts', '');
      tree.write('dir/node_modules/file1.ts', '');
      tree.write('dir/dir2/file2.ts', '');

      const visitor = jest.fn();
      visitNotIgnoredFiles(tree, dirPath, visitor);

      expect(visitor).toHaveBeenCalledWith('.gitignore');
      expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
      expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
      expect(visitor).not.toHaveBeenCalledWith('dir/node_modules/file1.ts');
    }
  );

  describe('nested ignore files', () => {
    function visitAll() {
      const visited: string[] = [];
      visitNotIgnoredFiles(tree, '', (p) => visited.push(p));
      return visited;
    }

    it('should honour a .gitignore in a subdirectory', () => {
      tree.write('apps/foo/.gitignore', 'skip.ts\n');
      tree.write('apps/foo/skip.ts', '');
      tree.write('apps/foo/kept.ts', '');
      // The same name elsewhere is outside that file's reach.
      tree.write('apps/bar/skip.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/skip.ts');
      expect(visited).toContain('apps/foo/kept.ts');
      expect(visited).toContain('apps/bar/skip.ts');
    });

    it('should anchor a nested pattern at its own directory', () => {
      // A bare filename matches at any depth, so it passes whether or not the
      // path is rebased. A leading slash is what actually pins the rebasing.
      tree.write('apps/foo/.gitignore', '/generated/\n');
      tree.write('apps/foo/generated/a.ts', '');
      tree.write('generated/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/generated/a.ts');
      expect(visited).toContain('generated/b.ts');
    });

    it('should let a nested negation re-include a file the root ignored', () => {
      // git overrides higher-level patterns with lower-level ones.
      tree.write('.gitignore', '*.log\n');
      tree.write('apps/foo/.gitignore', '!keep.log\n');
      tree.write('apps/foo/keep.log', '');
      tree.write('apps/foo/other.log', '');
      tree.write('apps/bar/keep.log', '');

      const visited = visitAll();

      expect(visited).toContain('apps/foo/keep.log');
      expect(visited).not.toContain('apps/foo/other.log');
      expect(visited).not.toContain('apps/bar/keep.log');
    });

    it('should honour a .nxignore in a subdirectory', () => {
      tree.write('apps/foo/.nxignore', 'skip.ts\n');
      tree.write('apps/foo/skip.ts', '');
      tree.write('apps/foo/kept.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/skip.ts');
      expect(visited).toContain('apps/foo/kept.ts');
    });

    it('should skip files under a directory a nested ignore file excludes', () => {
      // `dist/` is the canonical gitignore directory form, but the `ignore`
      // package cannot tell a slash-suffixed pattern targets a directory when
      // handed a path with no trailing slash, so the walker still descends and
      // skips each file individually. See the next case for actual pruning.
      tree.write('apps/foo/.gitignore', 'dist/\n');
      tree.write('apps/foo/dist/deep/a.ts', '');
      tree.write('apps/foo/src/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/dist/deep/a.ts');
      expect(visited).toContain('apps/foo/src/b.ts');
    });

    it('should not descend into a directory the chain excludes by name', () => {
      // No trailing slash, so the directory path itself matches. `children` is
      // spied on because asserting only on visited files cannot distinguish
      // "never descended" from "descended and skipped each file".
      tree.write('apps/foo/.gitignore', 'build\n');
      tree.write('apps/foo/build/deep/a.ts', '');
      tree.write('apps/foo/src/b.ts', '');
      const children = jest.spyOn(tree, 'children');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/build/deep/a.ts');
      expect(visited).toContain('apps/foo/src/b.ts');
      expect(children.mock.calls.map(([p]) => p)).not.toContain(
        'apps/foo/build'
      );
      children.mockRestore();
    });

    it('should prune a directory excluded with a trailing slash', () => {
      // `dist/` is the form git documents for directories, and `ignore` will not
      // match it against the slash-less path `dist`. Without probing directories
      // with a trailing slash the walk descends, and the nested negation below
      // then re-includes a file git would never have looked at.
      tree.write('.gitignore', 'dist/\n');
      tree.write('apps/foo/dist/.gitignore', '!keep.ts\n');
      tree.write('apps/foo/dist/keep.ts', '');
      tree.write('apps/foo/src/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/dist/keep.ts');
      expect(visited).toContain('apps/foo/src/b.ts');
    });

    it('should visit nothing when started inside a trailing-slash exclusion', () => {
      // Same leak as above, reached through the caller's `dirPath` instead of
      // the walk - the loop below never sees this directory, so the entry guard
      // is the only thing that can prune it.
      tree.write('.gitignore', 'dist/\n');
      tree.write('apps/foo/dist/.gitignore', '!keep.ts\n');
      tree.write('apps/foo/dist/keep.ts', '');

      const visited: string[] = [];
      visitNotIgnoredFiles(tree, 'apps/foo/dist', (p) => visited.push(p));

      expect(visited).toEqual([]);
    });

    it('should support the allowlist idiom', () => {
      // `*` then `!apps/` is how you opt in rather than out. It only works if
      // directories are asked about as `apps/` - probed as `apps`, the `*`
      // matches and `!apps/` cannot, so the whole tree is pruned. Verified
      // against real git, which visits `apps/a.ts` here.
      tree.write('.gitignore', '*\n!apps/\n!apps/**\n');
      tree.write('apps/a.ts', '');
      tree.write('other/b.ts', '');

      const visited = visitAll();

      expect(visited).toContain('apps/a.ts');
      expect(visited).not.toContain('other/b.ts');
    });

    it('should let a .nxignore negation re-include a .gitignore exclusion', () => {
      // The native walker gives `.nxignore` precedence, and master merged both
      // files into one matcher so it won there too.
      tree.write('.gitignore', 'generated\n');
      tree.write('.nxignore', '!generated\n');
      tree.write('generated/a.ts', '');
      tree.write('src/b.ts', '');

      const visited = visitAll();

      expect(visited).toContain('generated/a.ts');
      expect(visited).toContain('src/b.ts');
    });

    it('should not re-include a file under an excluded directory', () => {
      // git's rule, and the `ignore` package implements it: `!build/keep.ts`
      // cannot resurrect a file whose directory `build` already excluded.
      tree.write('apps/foo/.gitignore', 'build\n!build/keep.ts\n');
      tree.write('apps/foo/build/keep.ts', '');
      tree.write('apps/foo/src/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/build/keep.ts');
      expect(visited).toContain('apps/foo/src/b.ts');
    });

    it('should never visit the hardcoded directories, with no ignore file present', () => {
      // Shared with the native walker, so a tree walk and a filesystem walk
      // agree on what is never worth visiting.
      tree.write('.git/config', '');
      tree.write('node_modules/pkg/index.js', '');
      tree.write('.nx/cache/x.js', '');
      tree.write('a.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('.git/config');
      expect(visited).not.toContain('node_modules/pkg/index.js');
      expect(visited).not.toContain('.nx/cache/x.js');
      expect(visited).toContain('a.ts');
    });

    it('should not let a negation re-include a hardcoded directory', () => {
      tree.write('.gitignore', '!node_modules\n');
      tree.write('node_modules/pkg/index.js', '');

      expect(visitAll()).not.toContain('node_modules/pkg/index.js');
    });
  });

  // Differential against real git rather than hand-written expectations: the
  // cases above encode what we believe git does, this one asks it.
  //
  // Covers pattern semantics, file-vs-directory probing and the cascade. It
  // cannot cover how `.nxignore` merges with `.gitignore` - git has no
  // `.nxignore` - so the cases above are what pin that.
  describe('agreement with git', () => {
    const PATTERNS = [
      'dist/',
      'dist',
      // `dist/` excludes the directory, so git refuses to re-include anything
      // under it; `dist/**` excludes only the contents, so a later negation
      // does work. Without this entry the pair is never distinguished, and a
      // walker that stopped probing directories with a trailing slash would
      // still pass every other case.
      'dist/**',
      '*.log',
      'build',
      '/generated/',
      '**/tmp/',
      '*',
      'keep.ts',
      // The allowlist idiom needs both negations together, so it cannot be
      // reached by pairing one pattern with one negation.
      '*\n!apps/\n!apps/**',
    ];
    const NEGATIONS = ['', '!keep.ts', '!apps/', '!apps/**', '!dist/'];
    const FILES = [
      'a.ts',
      'keep.ts',
      // `/generated/` matches nothing without this, so those cases would assert
      // only that the walker ignores nothing. The nested copy is what makes the
      // leading slash observable: git anchors it to the root, so this one is
      // visited and `generated/a.ts` is not. Without the pair, stripping every
      // anchor from every pattern leaves the whole suite green.
      'generated/a.ts',
      'apps/generated/a.ts',
      'dist/a.ts',
      'dist/keep.ts',
      'apps/a.ts',
      'apps/keep.ts',
      'apps/dist/a.ts',
      'build/a.ts',
      'x.log',
      'apps/tmp/a.ts',
    ];
    // A nested ignore file, so the cascade is under test too. Without one every
    // case resolves the same root-only chain and `cascade` is never exercised.
    const NESTED = { 'apps/.gitignore': '!keep.ts\n' };

    let repo: string;

    beforeEach(() => {
      repo = mkdtempSync(join(tmpdir(), 'nx-ignore-oracle-'));
    });

    afterEach(() => {
      // Windows can hold a handle on a freshly written `.git` file past the
      // process that wrote it, which surfaces as a transient EBUSY/EPERM.
      rmSync(repo, { recursive: true, force: true, maxRetries: 3 });
    });

    /** What real git leaves untracked, i.e. does not ignore. */
    function gitVisits(gitignore: string): Set<string> {
      writeFileSync(join(repo, '.gitignore'), gitignore);
      for (const [path, contents] of Object.entries(NESTED)) {
        mkdirSync(dirname(join(repo, path)), { recursive: true });
        writeFileSync(join(repo, path), contents);
      }
      for (const file of FILES) {
        mkdirSync(dirname(join(repo, file)), { recursive: true });
        writeFileSync(join(repo, file), '');
      }
      // Every ambient `GIT_*` is dropped and the ones below are the only ones
      // set, so the oracle cannot depend on whoever is running the suite. An
      // allowlist rather than a denylist because git has more of these than is
      // practical to enumerate - `GIT_DIR` and `GIT_COMMON_DIR` relocate the
      // repo, and `GIT_INDEX_FILE`, which git does export to its hooks, makes
      // corpus files look tracked so `-o` drops them silently.
      //
      // Three things survive the filter and still need pinning: the config
      // files; `core.excludesFile`, whose default `~/.config/git/ignore` is a
      // path fallback rather than config; and git's built-in template dir.
      // `GIT_TEMPLATE_DIR` is empty rather than a nonexistent path - both stop
      // `.git/info/exclude` being seeded, but a missing template warns on every
      // case.
      const env: NodeJS.ProcessEnv = {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key))
        ),
        GIT_CONFIG_GLOBAL: join(repo, 'no-such-gitconfig'),
        GIT_CONFIG_SYSTEM: join(repo, 'no-such-gitconfig'),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.excludesFile',
        GIT_CONFIG_VALUE_0: join(repo, 'no-such-gitignore'),
        GIT_TEMPLATE_DIR: '',
      };
      // No `stdio: 'ignore'`: `-q` already silences the success path, and
      // discarding stderr would report every failure here - a missing git, a
      // read-only TMPDIR, `safe.directory` - as a bare "Command failed".
      execSync('git init -q .', { cwd: repo, env });
      const listed = execSync('git ls-files -o --exclude-standard', {
        cwd: repo,
        encoding: 'utf-8',
        env,
      });
      return new Set(listed.split('\n').filter((f) => FILES.includes(f)));
    }

    function walkerVisits(gitignore: string): Set<string> {
      tree.write('.gitignore', gitignore);
      for (const [path, contents] of Object.entries(NESTED)) {
        tree.write(path, contents);
      }
      for (const file of FILES) {
        tree.write(file, '');
      }
      const seen: string[] = [];
      visitNotIgnoredFiles(tree, '', (path) => seen.push(path));
      // `createTree` seeds files of its own; compare only the corpus.
      return new Set(seen.filter((f) => FILES.includes(f)));
    }

    // The label is pre-escaped rather than left to `%p`, which renders the
    // multi-line pattern across three lines and breaks `jest -t` filtering.
    it.each(
      PATTERNS.flatMap((pattern) =>
        NEGATIONS.map(
          (negation) =>
            [
              `${JSON.stringify(pattern)} + ${JSON.stringify(negation)}`,
              pattern,
              negation,
            ] as const
        )
      )
    )('matches git for %s', (_label, pattern, negation) => {
      const gitignore = [pattern, negation].filter(Boolean).join('\n') + '\n';

      expect([...walkerVisits(gitignore)].sort()).toEqual(
        [...gitVisits(gitignore)].sort()
      );
    });
  });
});
