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

  beforeEach(() => {
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
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
