import { TempFs } from '../../internal-testing-utils/temp-fs';
import { WatchEvent, Watcher } from '../index';

const wait = (ms = 1000) => new Promise<void>((res) => setTimeout(res, ms));

describe('watcher', () => {
  let temp: TempFs;
  let watcher: Watcher;
  beforeEach(() => {
    temp = new TempFs('watch-dir');
    temp.createFilesSync({
      '.gitignore': 'node_modules/\n.env.local',
      '.nxignore': 'app2/\n!.env.*\nboo.txt',
      '.env.local': '',
      'app1/main.js': '',
      'app1/main.css': '',
      'app2/main.js': '',
      'inner/.gitignore': '.env.inner',
      'inner/boo.txt': '',
      'inner/.env.inner': '',
      'nested-ignore/.gitignore': '*',
      'nested-ignore/file.js': '',
      'node_modules/module/index.js': '',
    });
  });

  afterEach(async () => {
    await watcher.stop();
    watcher = undefined;
    temp.cleanup();
  });

  it('should trigger the callback for files that are not ignored', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    temp.createFileSync('node_modules/my-file.json', JSON.stringify({}));
    await wait();
    temp.createFileSync('app2/main.css', JSON.stringify({}));
    await wait();
    temp.createFileSync('app1/main.html', JSON.stringify({}));
    await wait();

    expect(allPaths).toMatchInlineSnapshot(`
      [
        {
          "path": "app1/main.html",
          "type": "create",
        },
      ]
    `);
  }, 15000);

  it('should trigger the callback when files are updated', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    // nxignored file should not trigger a callback
    temp.appendFile('app2/main.js', 'update');
    await wait();
    temp.appendFile('app1/main.js', 'update');
    await wait();

    expect(allPaths).toMatchInlineSnapshot(`
      [
        {
          "path": "app1/main.js",
          "type": "update",
        },
      ]
    `);
  }, 15000);

  it('should watch file renames', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    temp.renameFile('app1/main.js', 'app1/rename.js');
    await wait();

    expect(allPaths.length).toBe(2);
    expect(allPaths.find((p) => p.type === 'create')).toMatchInlineSnapshot(`
      {
        "path": "app1/rename.js",
        "type": "create",
      }
    `);
    expect(allPaths.find((p) => p.type === 'delete')).toMatchInlineSnapshot(`
      {
        "path": "app1/main.js",
        "type": "delete",
      }
    `);
  }, 30000);

  it('should trigger on deletes', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    temp.removeFileSync('app1/main.js');
    await wait();

    expect(allPaths).toMatchInlineSnapshot(`
      [
        {
          "path": "app1/main.js",
          "type": "delete",
        },
      ]
    `);
  }, 15000);

  it('should ignore nested gitignores', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    // should not be triggered
    temp.createFileSync('nested-ignore/hello1.txt', '');
    await wait();
    temp.createFileSync('bar.txt', '');
    await wait();

    expect(allPaths).toMatchInlineSnapshot(`
      [
        {
          "path": "bar.txt",
          "type": "create",
        },
      ]
    `);
  }, 15000);

  it('prioritize nxignore over gitignores', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait(2000);
    temp.appendFile('.env.local', 'hello');
    temp.appendFile('inner/.env.inner', 'hello');
    temp.appendFile('inner/boo.txt', 'hello');
    await wait();

    expect(allPaths.some(({ path }) => path === '.env.local')).toBeTruthy();
    expect(
      allPaths.some(({ path }) => path === 'inner/.env.inner')
    ).toBeTruthy();
    expect(allPaths.some(({ path }) => path === 'inner/boo.txt')).toBeFalsy();
  }, 15000);

  it('should detect files created in newly created directories', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    // Create a new subdirectory (no file)
    temp.createDirSync('app1/newsubdir');

    // Wait for the watcher to register the new directory
    await wait(2000);

    // Create a file inside the new subdirectory
    temp.createFileSync('app1/newsubdir/newfile.ts', 'export const x = 1;');

    // Wait for the event to be processed
    await wait(2000);

    // Should detect the file created in the new subdirectory
    expect(
      allPaths.some(({ path }) => path === 'app1/newsubdir/newfile.ts')
    ).toBeTruthy();
  }, 15000);

  it('should detect files deleted in newly created directories', async () => {
    await wait();
    watcher = new Watcher(temp.tempDir);

    const allPaths: WatchEvent[] = [];
    watcher.watch((err, paths) => {
      allPaths.push(...paths);
    });

    await wait();
    // Create a new subdirectory
    temp.createDirSync('app1/newsubdir2');

    await wait(2000);

    // Create a file
    temp.createFileSync('app1/newsubdir2/todelete.ts', 'export const x = 1;');

    await wait(2000);

    // Delete the file
    temp.removeFileSync('app1/newsubdir2/todelete.ts');

    await wait(2000);

    // Should detect both the create and delete
    expect(
      allPaths.some(
        ({ path, type }) =>
          path === 'app1/newsubdir2/todelete.ts' && type === 'create'
      )
    ).toBeTruthy();
    expect(
      allPaths.some(
        ({ path, type }) =>
          path === 'app1/newsubdir2/todelete.ts' && type === 'delete'
      )
    ).toBeTruthy();
  }, 20000);
});
