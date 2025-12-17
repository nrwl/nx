import * as fs from 'node:fs';
import * as path from 'path';
import * as os from 'os';

import { CopyAssetsHandler } from './copy-assets-handler';

import { Subject } from 'rxjs';
import type { ChangedFile } from 'nx/src/daemon/client/client';

const mockWatcher = new Subject<ChangedFile>();

jest.mock(
  'nx/src/daemon/client/client',
  (): Partial<typeof import('nx/src/daemon/client/client')> => {
    const original = jest.requireActual('nx/src/daemon/client/client');
    return {
      ...original,
      daemonClient: {
        registerFileWatcher: async (
          config: unknown,
          callback: (
            err,
            data: {
              changedProjects: string[];
              changedFiles: ChangedFile[];
            }
          ) => void
        ) => {
          mockWatcher.subscribe((data) => {
            callback(null, {
              changedProjects: [],
              changedFiles: [data],
            });
          });
          return () => {};
        },
      },
    };
  }
);

function createMockedWatchedFile(path: string) {
  mockWatcher.next({
    type: 'create',
    path,
  });
}

function deletedMockedWatchedFile(path: string) {
  mockWatcher.next({
    type: 'delete',
    path,
  });
}

function updateMockedWatchedFile(path: string) {
  mockWatcher.next({
    type: 'update',
    path,
  });
}

describe('AssetInputOutputHandler', () => {
  let sut: CopyAssetsHandler;
  let rootDir: string;
  let projectDir: string;
  let outputDir: string;
  let callback: jest.SpyInstance;
  let originalCwd: string;

  beforeEach(() => {
    // Store original cwd to restore later
    originalCwd = process.cwd();

    // Resolve to real paths to avoid symlink discrepancies with watcher.
    const tmp = fs.realpathSync(path.join(os.tmpdir()));

    callback = jest.fn();
    rootDir = path.join(tmp, 'nx-assets-test');
    projectDir = path.join(rootDir, 'mylib');
    outputDir = path.join(rootDir, 'dist/mylib');

    // Reset temp directory
    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.mkdirSync(path.join(projectDir, 'docs/a/b'), { recursive: true });

    // Workspace ignore files
    fs.writeFileSync(path.join(rootDir, '.gitignore'), `git-ignore.md`);
    fs.writeFileSync(path.join(rootDir, '.nxignore'), `nx-ignore.md`);

    sut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir,
      callback: callback as any,
      assets: [
        'mylib/*.md',
        {
          input: 'mylib/docs',
          glob: '**/*.md',
          output: 'docs',
          ignore: ['ignore.md', '**/nested-ignore.md'],
        },
        'LICENSE',
      ],
    });
  });

  afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);
  });

  test('watchAndProcessOnAssetChange', async () => {
    const dispose = await sut.watchAndProcessOnAssetChange();

    createMockedWatchedFile(path.join(rootDir, 'LICENSE'));
    createMockedWatchedFile(path.join(projectDir, 'README.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/test1.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/test2.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/ignore.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/git-ignore.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/nx-ignore.md'));
    createMockedWatchedFile(path.join(projectDir, 'docs/a/b/nested-ignore.md'));
    updateMockedWatchedFile(path.join(projectDir, 'docs/test1.md'));
    deletedMockedWatchedFile(path.join(projectDir, 'docs/test1.md'));
    deletedMockedWatchedFile(path.join(projectDir, 'docs/test2.md'));

    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'LICENSE'),
        dest: path.join(rootDir, 'dist/mylib/LICENSE'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/README.md'),
        dest: path.join(rootDir, 'dist/mylib/README.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/test1.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/test2.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test2.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'update',
        src: path.join(rootDir, 'mylib/docs/test1.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'delete',
        src: path.join(rootDir, 'mylib/docs/test1.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'delete',
        src: path.join(rootDir, 'mylib/docs/test2.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test2.md'),
      },
    ]);
    expect(callback).not.toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/a/b/nested-ignore.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/a/b/nested-ignore.md'),
      },
    ]);

    dispose();
  });

  test('processAllAssetsOnce', async () => {
    fs.writeFileSync(path.join(rootDir, 'LICENSE'), 'license');
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
    fs.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
    fs.writeFileSync(path.join(projectDir, 'docs/test2.md'), 'test');
    fs.writeFileSync(path.join(projectDir, 'docs/ignore.md'), 'IGNORE ME');
    fs.writeFileSync(path.join(projectDir, 'docs/git-ignore.md'), 'IGNORE ME');
    fs.writeFileSync(path.join(projectDir, 'docs/nx-ignore.md'), 'IGNORE ME');
    fs.writeFileSync(
      path.join(projectDir, 'docs/a/b/nested-ignore.md'),
      'IGNORE ME'
    );

    await sut.processAllAssetsOnce();

    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'LICENSE'),
        dest: path.join(rootDir, 'dist/mylib/LICENSE'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/README.md'),
        dest: path.join(rootDir, 'dist/mylib/README.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/test1.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
      },
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/test2.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test2.md'),
      },
    ]);
  });

  test('should copy assets to correct location when running from nested directory', async () => {
    // Create a nested directory structure to simulate running from a subdirectory
    const nestedDir = path.join(rootDir, 'e2e', 'integration-tests');
    fs.mkdirSync(nestedDir, { recursive: true });

    // Change to nested directory to simulate running nx command from there
    process.chdir(nestedDir);

    // Create test files
    fs.writeFileSync(path.join(rootDir, 'LICENSE'), 'license');
    fs.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
    fs.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');

    // Create CopyAssetsHandler with relative outputDir (this is where the bug manifests)
    const nestedSut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir: 'dist/mylib', // relative path - this triggers the bug
      callback: callback as any,
      assets: [
        'mylib/*.md',
        {
          input: 'mylib/docs',
          glob: '**/*.md',
          output: 'docs',
        },
        'LICENSE',
      ],
    });

    await nestedSut.processAllAssetsOnce();

    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'LICENSE'),
        dest: path.join(rootDir, 'dist/mylib/LICENSE'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/README.md'),
        dest: path.join(rootDir, 'dist/mylib/README.md'),
      },
    ]);
    expect(callback).toHaveBeenCalledWith([
      {
        type: 'create',
        src: path.join(rootDir, 'mylib/docs/test1.md'),
        dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
      },
    ]);
  });

  describe('includeIgnoredFiles functionality', () => {
    test('should include ignored files when global includeIgnoredFiles is true', async () => {
      // Create a new handler with includeIgnoredFiles enabled globally
      const sutWithIncludeIgnored = new CopyAssetsHandler({
        rootDir,
        projectDir,
        outputDir,
        callback: callback as any,
        includeIgnoredFiles: true,
        assets: [
          'mylib/*.md',
          {
            input: 'mylib/docs',
            glob: '**/*.md',
            output: 'docs',
            ignore: ['ignore.md', '**/nested-ignore.md'],
          },
        ],
      });

      // Create test files including ones that would normally be ignored
      fs.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
      fs.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
      fs.writeFileSync(
        path.join(projectDir, 'docs/git-ignore.md'),
        'GIT IGNORED'
      );
      fs.writeFileSync(
        path.join(projectDir, 'docs/nx-ignore.md'),
        'NX IGNORED'
      );
      fs.writeFileSync(
        path.join(projectDir, 'docs/ignore.md'),
        'ASSET IGNORED'
      );

      await sutWithIncludeIgnored.processAllAssetsOnce();

      // Should include git and nx ignored files but still respect asset-specific ignore
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/README.md'),
          dest: path.join(rootDir, 'dist/mylib/README.md'),
        },
      ]);
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/test1.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
          }),
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/git-ignore.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/git-ignore.md'),
          }),
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/nx-ignore.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/nx-ignore.md'),
          }),
        ])
      );

      // Should still respect asset-specific ignore patterns
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/ignore.md'),
          }),
        ])
      );
    });

    test('should include ignored files for specific assets when per-asset includeIgnoredFiles is true', async () => {
      // Create handler with per-asset includeIgnoredFiles
      const sutWithPerAssetInclude = new CopyAssetsHandler({
        rootDir,
        projectDir,
        outputDir,
        callback: callback as any,
        includeIgnoredFiles: false, // Global is false
        assets: [
          'mylib/*.md', // This asset will exclude ignored files
          {
            input: 'mylib/docs',
            glob: '**/*.md',
            output: 'docs',
            includeIgnoredFiles: true, // This asset will include ignored files
            ignore: ['ignore.md'],
          },
        ],
      });

      // Create test files
      fs.writeFileSync(path.join(projectDir, 'git-ignore.md'), 'GIT IGNORED');
      fs.writeFileSync(path.join(projectDir, 'nx-ignore.md'), 'NX IGNORED');
      fs.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
      fs.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
      fs.writeFileSync(
        path.join(projectDir, 'docs/git-ignore.md'),
        'GIT IGNORED'
      );
      fs.writeFileSync(
        path.join(projectDir, 'docs/nx-ignore.md'),
        'NX IGNORED'
      );
      fs.writeFileSync(
        path.join(projectDir, 'docs/ignore.md'),
        'ASSET IGNORED'
      );

      await sutWithPerAssetInclude.processAllAssetsOnce();

      // First asset (mylib/*.md) should exclude ignored files
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/README.md'),
          dest: path.join(rootDir, 'dist/mylib/README.md'),
        },
      ]);

      // Should NOT include ignored files for first asset
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/git-ignore.md'),
          }),
        ])
      );
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/nx-ignore.md'),
          }),
        ])
      );

      // Second asset (docs) should include git/nx ignored files but respect asset ignore
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/test1.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
          }),
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/git-ignore.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/git-ignore.md'),
          }),
          expect.objectContaining({
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/nx-ignore.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/nx-ignore.md'),
          }),
        ])
      );

      // Should still respect asset-specific ignore even with includeIgnoredFiles: true
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/ignore.md'),
          }),
        ])
      );
    });

    test('should respect per-asset includeIgnoredFiles precedence over global setting', async () => {
      // Create handler where global is true but per-asset is false
      const sutWithMixedSettings = new CopyAssetsHandler({
        rootDir,
        projectDir,
        outputDir,
        callback: callback as any,
        includeIgnoredFiles: true, // Global is true
        assets: [
          {
            input: 'mylib/docs',
            glob: '**/*.md',
            output: 'docs',
            includeIgnoredFiles: false, // This asset explicitly excludes ignored files
          },
        ],
      });

      // Create test files
      fs.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
      fs.writeFileSync(
        path.join(projectDir, 'docs/git-ignore.md'),
        'GIT IGNORED'
      );
      fs.writeFileSync(
        path.join(projectDir, 'docs/nx-ignore.md'),
        'NX IGNORED'
      );

      await sutWithMixedSettings.processAllAssetsOnce();

      // Should include regular files
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/docs/test1.md'),
          dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
        },
      ]);

      // Should NOT include ignored files because per-asset setting overrides global
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/git-ignore.md'),
          }),
        ])
      );
      expect(callback).not.toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/nx-ignore.md'),
          }),
        ])
      );
    });

    test('should include ignored files during watch mode when includeIgnoredFiles is enabled', async () => {
      // Create handler with includeIgnoredFiles enabled
      const sutWithIncludeIgnored = new CopyAssetsHandler({
        rootDir,
        projectDir,
        outputDir,
        callback: callback as any,
        includeIgnoredFiles: true,
        assets: [
          {
            input: 'mylib/docs',
            glob: '**/*.md',
            output: 'docs',
          },
        ],
      });

      const dispose =
        await sutWithIncludeIgnored.watchAndProcessOnAssetChange();

      // Simulate creating ignored files
      createMockedWatchedFile(path.join(projectDir, 'docs/git-ignore.md'));
      createMockedWatchedFile(path.join(projectDir, 'docs/nx-ignore.md'));
      createMockedWatchedFile(path.join(projectDir, 'docs/regular.md'));

      // Should include all files including ignored ones
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/docs/git-ignore.md'),
          dest: path.join(rootDir, 'dist/mylib/docs/git-ignore.md'),
        },
      ]);
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/docs/nx-ignore.md'),
          dest: path.join(rootDir, 'dist/mylib/docs/nx-ignore.md'),
        },
      ]);
      expect(callback).toHaveBeenCalledWith([
        {
          type: 'create',
          src: path.join(rootDir, 'mylib/docs/regular.md'),
          dest: path.join(rootDir, 'dist/mylib/docs/regular.md'),
        },
      ]);

      dispose();
    });

    test('should handle includeIgnoredFiles with nested gitignore patterns', async () => {
      // Create nested gitignore with more complex patterns
      fs.writeFileSync(
        path.join(rootDir, '.gitignore'),
        `
*.log
temp-*
build/
*.tmp.md
`
      );

      const sutWithIncludeIgnored = new CopyAssetsHandler({
        rootDir,
        projectDir,
        outputDir,
        callback: callback as any,
        includeIgnoredFiles: true,
        assets: [
          {
            input: 'mylib/docs',
            glob: '**/*',
            output: 'docs',
          },
        ],
      });

      // Create files that match gitignore patterns
      fs.writeFileSync(path.join(projectDir, 'docs/debug.log'), 'LOG');
      fs.writeFileSync(path.join(projectDir, 'docs/temp-file.md'), 'TEMP');
      fs.writeFileSync(path.join(projectDir, 'docs/report.tmp.md'), 'TEMP MD');
      fs.writeFileSync(path.join(projectDir, 'docs/regular.md'), 'REGULAR');
      fs.mkdirSync(path.join(projectDir, 'docs/build'), { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'docs/build/output.js'), 'BUILD');

      await sutWithIncludeIgnored.processAllAssetsOnce();

      // Should include all files, even those matching gitignore patterns
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/debug.log'),
          }),
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/temp-file.md'),
          }),
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/report.tmp.md'),
          }),
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/regular.md'),
          }),
          expect.objectContaining({
            src: path.join(rootDir, 'mylib/docs/build/output.js'),
          }),
        ])
      );
    });
  });
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CopyAssetsHandler - node_modules support', () => {
  let rootDir: string;
  let projectDir: string;
  let outputDir: string;
  let callback: jest.SpyInstance;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    const tmp = fs.realpathSync(path.join(os.tmpdir()));

    callback = jest.fn();
    rootDir = path.join(tmp, 'nx-assets-node-modules-test');
    projectDir = path.join(rootDir, 'apps/api');
    outputDir = path.join(rootDir, 'dist/apps/api');

    fs.rmSync(rootDir, { recursive: true, force: true });
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(rootDir, 'node_modules/.prisma/client'), {
      recursive: true,
    });
    fs.mkdirSync(path.join(rootDir, 'node_modules/@prisma/client'), {
      recursive: true,
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  test('should copy files from node_modules/.prisma using async method', async () => {
    // Create mock Prisma client files
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/.prisma/client/index.js'),
      'prisma client'
    );
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/.prisma/client/index.d.ts'),
      'prisma types'
    );
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/.prisma/client/schema.prisma'),
      'schema'
    );

    const sut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir,
      callback: callback as any,
      assets: [
        {
          input: 'node_modules/.prisma/client',
          glob: '**/*',
          output: 'prisma-client',
        },
      ],
    });

    await sut.processAllAssetsOnce();

    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/.prisma/client/index.js'),
          dest: path.join(rootDir, 'dist/apps/api/prisma-client/index.js'),
        }),
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/.prisma/client/index.d.ts'),
          dest: path.join(rootDir, 'dist/apps/api/prisma-client/index.d.ts'),
        }),
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/.prisma/client/schema.prisma'),
          dest: path.join(rootDir, 'dist/apps/api/prisma-client/schema.prisma'),
        }),
      ])
    );
  });

  test('should copy files from node_modules/.prisma using sync method', () => {
    // Create mock Prisma client files
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/.prisma/client/index.js'),
      'prisma client'
    );
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/.prisma/client/index.d.ts'),
      'prisma types'
    );

    const sut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir,
      callback: callback as any,
      assets: [
        {
          input: 'node_modules/.prisma/client',
          glob: '**/*',
          output: 'prisma-client',
        },
      ],
    });

    sut.processAllAssetsOnceSync();

    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/.prisma/client/index.js'),
          dest: path.join(rootDir, 'dist/apps/api/prisma-client/index.js'),
        }),
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/.prisma/client/index.d.ts'),
          dest: path.join(rootDir, 'dist/apps/api/prisma-client/index.d.ts'),
        }),
      ])
    );
  });

  test('should copy files from node_modules/@prisma/client', async () => {
    // Create mock @prisma/client files
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/@prisma/client/index.js'),
      'prisma client'
    );
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/@prisma/client/package.json'),
      '{"name": "@prisma/client"}'
    );

    const sut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir,
      callback: callback as any,
      assets: [
        {
          input: 'node_modules/@prisma/client',
          glob: '**/*',
          output: '@prisma/client',
        },
      ],
    });

    await sut.processAllAssetsOnce();

    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/@prisma/client/index.js'),
          dest: path.join(rootDir, 'dist/apps/api/@prisma/client/index.js'),
        }),
        expect.objectContaining({
          type: 'create',
          src: path.join(rootDir, 'node_modules/@prisma/client/package.json'),
          dest: path.join(rootDir, 'dist/apps/api/@prisma/client/package.json'),
        }),
      ])
    );
  });

  test('should still ignore node_modules for non-node_modules patterns', async () => {
    // Create files in project directory and in node_modules that would match the pattern
    fs.writeFileSync(path.join(projectDir, 'config.json'), 'config');
    fs.writeFileSync(
      path.join(rootDir, 'node_modules/@prisma/client/package.json'),
      '{"name": "@prisma/client"}'
    );

    const sut = new CopyAssetsHandler({
      rootDir,
      projectDir,
      outputDir,
      callback: callback as any,
      assets: [
        {
          input: 'apps/api',
          glob: '**/*.json',
          output: 'assets',
        },
      ],
    });

    await sut.processAllAssetsOnce();

    // Should include project files
    expect(callback).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'create',
        src: path.join(rootDir, 'apps/api/config.json'),
        dest: path.join(rootDir, 'dist/apps/api/assets/config.json'),
      }),
    ]);

    // Should NOT include node_modules files even though they match the glob pattern
    const allCalls = callback.mock.calls.flat().flat();
    const nodeModulesFiles = allCalls.filter((event: any) =>
      event.src.includes('node_modules')
    );
    expect(nodeModulesFiles).toHaveLength(0);
  });
});
