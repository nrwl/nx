import { hashArray, hashFile, Watcher } from '../index';

import { tmpdir } from 'os';
import { mkdtemp, realpathSync, writeFile } from 'fs-extra';
import { join } from 'path';
import { TempFs } from '../../utils/testing/temp-fs';

describe('native', () => {
  it('should hash files', async () => {
    expect(hashFile).toBeDefined();

    const tempDirPath = await mkdtemp(join(tmpdir(), 'native-test'));
    const tempFilePath = join(tempDirPath, 'temp.txt');
    await writeFile(tempFilePath, 'content');

    expect(hashFile(tempFilePath).hash).toBe('6193209363630369380');
  });

  it('should hash content', async () => {
    expect(hashArray).toBeDefined();

    expect(hashArray(['one', 'two'])).toEqual('10960201262927338690');
  });

  it('should create an instance of NativeHasher', () => {
    // const nativeHasher = new NativeFileHasher('/root');
    // expect(nativeHasher instanceof NativeFileHasher).toBe(true);
  });
});

describe('watcher', () => {
  let temp: TempFs;
  let watcher: Watcher;
  beforeEach(() => {
    temp = new TempFs('watch-dir');
    temp.createFilesSync({
      '.gitignore': 'node_modules/',
      '.nxignore': 'app2/',
      'app1/main.js': '',
      'app1/main.css': '',
      'app2/main.js': '',
      'nested-ignore/.gitignore': '*',
      'nested-ignore/file.js': '',
      'node_modules/module/index.js': '',
    });

    console.log(`watching ${temp.tempDir}`);
    watcher = new Watcher(realpathSync(temp.tempDir));
  });

  afterEach(() => {
    watcher.stop();
    temp.cleanup();
  });

  xit('should test', (done) => {
    let w = new Watcher('/Users/jon/Dev/nx');
    w.watch((err, paths) => {
      console.log(paths);
    });
  }, 10_000_000);

  it('should trigger the callback for files that are not ignored', (done) => {
    watcher.watch((error, paths) => {
      expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "app1/main.html",
            "type": "update",
          },
        ]
      `);
      done();
    });

    wait().then(() => {
      temp.createFileSync('node_modules/my-file.json', JSON.stringify({}));
      temp.createFileSync('app2/main.css', JSON.stringify({}));
      temp.createFileSync('app1/main.html', JSON.stringify({}));
    });
  });

  it('should trigger the callback when files are updated', (done) => {
    watcher.watch((err, paths) => {
      expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "app1/main.js",
            "type": "update",
          },
        ]
      `);
      done();
    });

    wait().then(() => {
      // nxignored file should not trigger a callback
      temp.appendFile('app2/main.js', 'update');
      temp.appendFile('app1/main.js', 'update');
    });
  });

  it('should watch file renames', (done) => {
    watcher.watch((err, paths) => {
      expect(paths.length).toBe(2);
      expect(paths.find((p) => p.type === 'update')).toMatchObject({
        path: 'app1/rename.js',
        type: 'update',
      });
      expect(paths.find((p) => p.type === 'delete')).toMatchObject({
        path: 'app1/main.js',
        type: 'delete',
      });
      done();
    });

    wait().then(() => {
      temp.renameFile('app1/main.js', 'app1/rename.js');
    });
  });

  it('should trigger on deletes', (done) => {
    watcher.watch((err, paths) => {
      expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "app1/main.js",
            "type": "delete",
          },
        ]
      `);
      done();
    });

    wait().then(() => {
      temp.removeFileSync('app1/main.js');
    });
  });

  it('should ignore nested gitignores', (done) => {
    watcher.watch((err, paths) => {
      expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "boo.txt",
            "type": "update",
          },
        ]
      `);
      done();
    });

    wait().then(() => {
      // should not be triggered
      temp.createFileSync('nested-ignore/hello1.txt', '');
      temp.createFileSync('boo.txt', '');
    });
  });
});

function wait() {
  return new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, 250);
  });
}
