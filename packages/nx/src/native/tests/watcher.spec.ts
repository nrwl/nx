import { TempFs } from '../../internal-testing-utils/temp-fs';
import { Watcher } from '../index';

describe('watcher', () => {
  let temp: TempFs;
  let watcher: Watcher;
  beforeEach(() => {
    temp = new TempFs('watch-dir');
    temp.createFilesSync({
      '.gitignore': 'node_modules/\n.env.local',
      '.nxignore': 'app2/\n!.env.local',
      '.env.local': '',
      'app1/main.js': '',
      'app1/main.css': '',
      'app2/main.js': '',
      'nested-ignore/.gitignore': '*',
      'nested-ignore/file.js': '',
      'node_modules/module/index.js': '',
    });

    console.log(`watching ${temp.tempDir}`);
  });

  afterEach(async () => {
    await watcher.stop();
    watcher = undefined;
    temp.cleanup();
  });

  it('should trigger the callback for files that are not ignored', async () => {
    return new Promise<void>(async (done) => {
      await wait();

      watcher = new Watcher(temp.tempDir);
      watcher.watch((error, paths) => {
        expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "app1/main.html",
            "type": "create",
          },
        ]
      `);
        done();
      });

      await wait();
      temp.createFileSync('node_modules/my-file.json', JSON.stringify({}));
      await wait();
      temp.createFileSync('app2/main.css', JSON.stringify({}));
      await wait();
      temp.createFileSync('app1/main.html', JSON.stringify({}));
    });
  }, 10000);

  it('should trigger the callback when files are updated', async () => {
    return new Promise<void>(async (done) => {
      await wait();
      watcher = new Watcher(temp.tempDir);

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

      await wait();
      // nxignored file should not trigger a callback
      temp.appendFile('app2/main.js', 'update');
      await wait();
      temp.appendFile('app1/main.js', 'update');
    });
  }, 10000);

  it('should watch file renames', async () => {
    return new Promise<void>(async (done) => {
      await wait();
      watcher = new Watcher(temp.tempDir);

      watcher.watch((err, paths) => {
        expect(paths.length).toBe(2);
        expect(paths.find((p) => p.type === 'create')).toMatchInlineSnapshot(`
        {
          "path": "app1/rename.js",
          "type": "create",
        }
      `);
        expect(paths.find((p) => p.type === 'delete')).toMatchInlineSnapshot(`
        {
          "path": "app1/main.js",
          "type": "delete",
        }
      `);
        done();
      });

      await wait();
      temp.renameFile('app1/main.js', 'app1/rename.js');
    });
  }, 10000);

  it('should trigger on deletes', async () => {
    return new Promise<void>(async (done) => {
      await wait();
      watcher = new Watcher(temp.tempDir);

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

      await wait();
      temp.removeFileSync('app1/main.js');
    });
  }, 10000);

  it('should ignore nested gitignores', async () => {
    return new Promise<void>(async (done) => {
      await wait();

      watcher = new Watcher(temp.tempDir);

      watcher.watch((err, paths) => {
        expect(paths).toMatchInlineSnapshot(`
        [
          {
            "path": "boo.txt",
            "type": "create",
          },
        ]
      `);
        done();
      });

      await wait();
      // should not be triggered
      temp.createFileSync('nested-ignore/hello1.txt', '');
      await wait();
      temp.createFileSync('boo.txt', '');
    });
  }, 10000);

  it('should include files that are negated in nxignore but are ignored in gitignore', async () => {
    return new Promise<void>(async (done) => {
      await wait();
      watcher = new Watcher(temp.tempDir);
      watcher.watch((err, paths) => {
        expect(paths.some(({ path }) => path === '.env.local')).toBeTruthy();
        done();
      });

      await wait(2000);
      temp.appendFile('.env.local', 'hello');
    });
  }, 15000);
});

function wait(timeout = 1000) {
  return new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, timeout);
  });
}
