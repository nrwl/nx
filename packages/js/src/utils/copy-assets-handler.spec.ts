import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as fse from 'fs-extra';

import { CopyAssetsHandler } from './copy-assets-handler';

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
    fse.removeSync(rootDir);
    fse.mkdirpSync(path.join(projectDir, 'docs/a/b'));

    // Workspace ignore files
    fse.writeFileSync(path.join(rootDir, '.gitignore'), `git-ignore.md`);
    fse.writeFileSync(path.join(rootDir, '.nxignore'), `nx-ignore.md`);

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

    fse.writeFileSync(path.join(rootDir, 'LICENSE'), 'license');
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
    await wait(100); // give watch time to react
    fse.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'docs/test2.md'), 'test');
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'docs/ignore.md'), 'IGNORE ME');
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'docs/git-ignore.md'), 'IGNORE ME');
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'docs/nx-ignore.md'), 'IGNORE ME');
    await wait(100);
    fse.writeFileSync(
      path.join(projectDir, 'docs/a/b/nested-ignore.md'),
      'IGNORE ME'
    );
    await wait(100);
    fse.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'updated');
    await wait(100);
    fse.removeSync(path.join(projectDir, 'docs'));
    await wait(100);

    expect(callback.mock.calls).toEqual([
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'LICENSE'),
            dest: path.join(rootDir, 'dist/mylib/LICENSE'),
          },
        ],
      ],
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'mylib/README.md'),
            dest: path.join(rootDir, 'dist/mylib/README.md'),
          },
        ],
      ],
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/test1.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
          },
        ],
      ],
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'mylib/docs/test2.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test2.md'),
          },
        ],
      ],
      [
        [
          {
            type: 'update',
            src: path.join(rootDir, 'mylib/docs/test1.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
          },
        ],
      ],
      // Deleting the directory should only happen once, not per file.
      [
        [
          {
            type: 'delete',
            src: path.join(rootDir, 'mylib/docs/test1.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test1.md'),
          },
          {
            type: 'delete',
            src: path.join(rootDir, 'mylib/docs/test2.md'),
            dest: path.join(rootDir, 'dist/mylib/docs/test2.md'),
          },
        ],
      ],
    ]);

    await dispose();
    fse.removeSync(rootDir);
  });

  test('processAllAssetsOnce', async () => {
    fse.writeFileSync(path.join(rootDir, 'LICENSE'), 'license');
    fse.writeFileSync(path.join(projectDir, 'README.md'), 'readme');
    fse.writeFileSync(path.join(projectDir, 'docs/test1.md'), 'test');
    fse.writeFileSync(path.join(projectDir, 'docs/test2.md'), 'test');
    fse.writeFileSync(path.join(projectDir, 'docs/ignore.md'), 'IGNORE ME');
    fse.writeFileSync(path.join(projectDir, 'docs/git-ignore.md'), 'IGNORE ME');
    fse.writeFileSync(path.join(projectDir, 'docs/nx-ignore.md'), 'IGNORE ME');
    fse.writeFileSync(
      path.join(projectDir, 'docs/a/b/nested-ignore.md'),
      'IGNORE ME'
    );

    await sut.processAllAssetsOnce();

    expect(callback.mock.calls).toEqual([
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'LICENSE'),
            dest: path.join(rootDir, 'dist/mylib/LICENSE'),
          },
        ],
      ],
      [
        [
          {
            type: 'create',
            src: path.join(rootDir, 'mylib/README.md'),
            dest: path.join(rootDir, 'dist/mylib/README.md'),
          },
        ],
      ],
      [
        [
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
        ],
      ],
    ]);
  });
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
