import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

// `var` so the getter below can read it during module initialization, when
// modules pulled in by the import chain resolve paths from the workspace root.
var mockWorkspaceRoot: string | undefined;
jest.mock('./workspace-root', () => ({
  get workspaceRoot() {
    return mockWorkspaceRoot ?? process.cwd();
  },
}));

import { parseFiles } from './command-line-utils';

function runGit(args: string[], cwd: string) {
  execFileSync('git', args, { cwd, stdio: 'ignore', windowsHide: true });
}

describe('parseFiles', () => {
  let tempDirectory: string;
  let repository: string;

  function write(relativePath: string, contents: string) {
    const absolutePath = join(repository, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  function commitAll(message: string) {
    runGit(['add', '.'], repository);
    runGit(['commit', '-m', message], repository);
  }

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'nx-parse-files-'));
    repository = join(tempDirectory, 'repo');
    mkdirSync(repository);
    runGit(['init'], repository);
    runGit(['config', 'user.email', 'test@example.com'], repository);
    runGit(['config', 'user.name', 'Test User'], repository);
    // Git quotes non-ASCII paths when this is on, which is the default. Set it
    // explicitly so the test does not depend on the developer's global config.
    runGit(['config', 'core.quotepath', 'true'], repository);
    mockWorkspaceRoot = repository;
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('reports uncommitted changes under a non-ASCII directory', () => {
    write('apps/cart/src/app/Einkäufe/test.tsx', 'initial');
    commitAll('initial commit');

    write('apps/cart/src/app/Einkäufe/test.tsx', 'changed');

    expect(parseFiles({ uncommitted: true }).files).toEqual([
      'apps/cart/src/app/Einkäufe/test.tsx',
    ]);
  });

  it('reports untracked files under a non-ASCII directory', () => {
    write('apps/cart/src/app/placeholder.tsx', 'initial');
    commitAll('initial commit');

    write('apps/cart/src/app/Größe/new.tsx', 'new');

    expect(parseFiles({ untracked: true }).files).toEqual([
      'apps/cart/src/app/Größe/new.tsx',
    ]);
  });

  it('reports files changed between two revisions under a non-ASCII directory', () => {
    write('apps/cart/src/app/Einkäufe/test.tsx', 'initial');
    commitAll('initial commit');

    write('apps/cart/src/app/Einkäufe/test.tsx', 'changed');
    commitAll('second commit');

    expect(parseFiles({ base: 'HEAD~1', head: 'HEAD' }).files).toEqual([
      'apps/cart/src/app/Einkäufe/test.tsx',
    ]);
  });

  // Windows does not allow `"` or a trailing space in a path segment.
  (process.platform === 'win32' ? it.skip : it)(
    'reports paths containing characters that git escapes even when quotepath is off',
    () => {
      write('apps/cart/src/app/a"b/test.tsx', 'initial');
      write('apps/cart/src/app/trailing /test.tsx', 'initial');
      commitAll('initial commit');

      write('apps/cart/src/app/a"b/test.tsx', 'changed');
      write('apps/cart/src/app/trailing /test.tsx', 'changed');

      expect(parseFiles({ uncommitted: true }).files.sort()).toEqual([
        'apps/cart/src/app/a"b/test.tsx',
        'apps/cart/src/app/trailing /test.tsx',
      ]);
    }
  );
});
