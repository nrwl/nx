import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { WorkspaceContext } from '../index';

// What a watching context holds after a change, with the ignore rules a walk
// applies: the watch sees more than the files should, and the rules decide
// what enters them. The cases are the ones the napi watcher's spec used to
// cover, against the files rather than the raw events.
describe('WorkspaceContext ignore rules under its watcher', () => {
  let workspace: string;
  let cacheDir: string;
  let context: WorkspaceContext | undefined;

  beforeEach(() => {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'nx-ctx-ignores-')));
    cacheDir = mkdtempSync(join(tmpdir(), 'nx-ctx-ignores-cache-'));
    write('.gitignore', 'node_modules/\n.env.local');
    write('.nxignore', 'app2/\n!.env.*\nboo.txt');
    write('.env.local', '');
    write('app1/main.js', '');
    write('app1/main.css', '');
    write('app2/main.js', '');
    write('inner/.gitignore', '.env.inner');
    write('inner/boo.txt', '');
    write('inner/.env.inner', '');
    write('nested-ignore/.gitignore', '*');
    write('nested-ignore/file.js', '');
    write('node_modules/module/index.js', '');
  });

  afterEach(() => {
    context?.stopWatching();
    context = undefined;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  });

  function write(file: string, content: string) {
    const path = join(workspace, file);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }

  function watch(): WorkspaceContext {
    context = new WorkspaceContext(workspace, cacheDir, { watch: true });
    context.allFileData();
    return context;
  }

  function names(): string[] {
    return context.allFileData().map((f) => f.file);
  }

  function hashOf(file: string): string | undefined {
    return context.allFileData().find((f) => f.file === file)?.hash;
  }

  async function eventually(
    what: string,
    condition: () => boolean,
    timeoutMs = 10000
  ) {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error(what);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  it('takes in a new file and leaves out the ignored ones', async () => {
    watch();
    write('node_modules/my-file.json', '{}');
    write('app2/main.css', '{}');
    write('app1/main.html', '{}');

    await eventually('the new file never reached the files', () =>
      names().includes('app1/main.html')
    );
    expect(names()).not.toContain('node_modules/my-file.json');
    expect(names()).not.toContain('app2/main.css');
  });

  it('takes in an update and leaves out an ignored one', async () => {
    watch();
    const before = hashOf('app1/main.js');
    write('app2/main.js', 'update');
    write('app1/main.js', 'update');

    await eventually(
      'the update never reached the files',
      () => hashOf('app1/main.js') !== before
    );
    expect(names()).not.toContain('app2/main.js');
  });

  it('moves a renamed file', async () => {
    watch();
    renameSync(
      join(workspace, 'app1/main.js'),
      join(workspace, 'app1/rename.js')
    );

    await eventually('the rename never reached the files', () =>
      names().includes('app1/rename.js')
    );
    await eventually(
      'the old name never left the files',
      () => !names().includes('app1/main.js')
    );
  });

  it('drops a deleted file', async () => {
    watch();
    rmSync(join(workspace, 'app1/main.js'));

    await eventually(
      'the delete never reached the files',
      () => !names().includes('app1/main.js')
    );
  });

  it('honours a nested gitignore', async () => {
    watch();
    write('nested-ignore/hello1.txt', '');
    write('bar.txt', '');

    await eventually('the tracked write never reached the files', () =>
      names().includes('bar.txt')
    );
    expect(names()).not.toContain('nested-ignore/hello1.txt');
  });

  it('lets .nxignore outrank .gitignore', async () => {
    watch();
    write('.env.local', 'hello');
    write('inner/.env.inner', 'hello');
    write('inner/boo.txt', 'hello');

    // Both dotenv files are gitignored and un-ignored by the root .nxignore;
    // boo.txt is the other way round.
    await eventually('a .nxignore un-ignore never reached the files', () =>
      ['.env.local', 'inner/.env.inner'].every((f) => names().includes(f))
    );
    expect(names()).not.toContain('inner/boo.txt');
  });

  it('follows files created and deleted in a new directory', async () => {
    watch();
    mkdirSync(join(workspace, 'app1/newsubdir'));
    write('app1/newsubdir/newfile.ts', 'export const x = 1;');

    await eventually('a file in a new directory never reached the files', () =>
      names().includes('app1/newsubdir/newfile.ts')
    );

    rmSync(join(workspace, 'app1/newsubdir/newfile.ts'));
    await eventually(
      'the delete in a new directory never reached the files',
      () => !names().includes('app1/newsubdir/newfile.ts')
    );
  });

  // Monorepo-scale trees: the watch must cover 10,000 directories without
  // silently dropping events for what is deep inside them.
  it('follows changes deep in a large directory tree', async () => {
    for (let scope = 0; scope < 20; scope++) {
      for (let project = 0; project < 50; project++) {
        for (let dir = 0; dir < 10; dir++) {
          write(
            `packages/scope-${scope}/project-${project}/dir-${dir}/file.ts`,
            `// ${scope}-${project}-${dir}`
          );
        }
      }
    }
    watch();
    const deep = 'packages/scope-15/project-40/dir-8/file.ts';
    const before = hashOf(deep);

    write(
      'packages/scope-10/project-25/dir-5/newfile.ts',
      'export const x = 1;'
    );
    write(deep, '// updated');

    await eventually(
      'a create deep in the tree never reached the files',
      () => names().includes('packages/scope-10/project-25/dir-5/newfile.ts'),
      30000
    );
    await eventually(
      'an update deep in the tree never reached the files',
      () => hashOf(deep) !== before,
      30000
    );
  }, 60000);
});
