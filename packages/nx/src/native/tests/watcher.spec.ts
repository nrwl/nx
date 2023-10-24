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

  it('should trigger the callback for files that are not ignored', (done) => {
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

    wait().then(() => {
      temp.createFileSync('node_modules/my-file.json', JSON.stringify({}));
      temp.createFileSync('app2/main.css', JSON.stringify({}));
      temp.createFileSync('app1/main.html', JSON.stringify({}));
    });
  });

  it('should trigger the callback when files are updated', (done) => {
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

    wait(1000).then(() => {
      // nxignored file should not trigger a callback
      temp.appendFile('app2/main.js', 'update');
      temp.appendFile('app1/main.js', 'update');
    });
  });

  it('should watch file renames', (done) => {
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

    wait().then(() => {
      temp.renameFile('app1/main.js', 'app1/rename.js');
    });
  });

  it('should trigger on deletes', (done) => {
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

    wait().then(() => {
      temp.removeFileSync('app1/main.js');
    });
  });

  it('should ignore nested gitignores', (done) => {
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

    wait().then(() => {
      // should not be triggered
      temp.createFileSync('nested-ignore/hello1.txt', '');
      temp.createFileSync('boo.txt', '');
    });
  });

  it('should include files that are negated in nxignore but are ignored in gitignore', (done) => {
    watcher = new Watcher(temp.tempDir);
    watcher.watch((err, paths) => {
      expect(paths.some(({ path }) => path === '.env.local')).toBeTruthy();
      done();
    });

    wait().then(() => {
      temp.appendFile('.env.local', 'hello');
    });
  });
});

function wait(timeout = 500) {
  return new Promise<void>((res) => {
    setTimeout(() => {
      res();
    }, timeout);
  });
}
