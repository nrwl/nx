import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ChangeBatch, WatchEvent, WorkspaceContext } from '../index';

// A context built with `watch: true` keeps its own files current: nothing
// tells it about writes, it hears them from the watcher it owns and applies
// them before answering a read.
describe('WorkspaceContext with its own watcher', () => {
  let workspace: string;
  let cacheDir: string;
  let context: WorkspaceContext | undefined;

  beforeEach(() => {
    workspace = realpathSync(mkdtempSync(join(tmpdir(), 'nx-ctx-watch-')));
    // Cache lives outside the workspace so context bookkeeping files
    // cannot generate watcher events or show up in the scan.
    cacheDir = mkdtempSync(join(tmpdir(), 'nx-ctx-watch-cache-'));
  });

  afterEach(() => {
    context?.stopWatching();
    context = undefined;
    rmSync(workspace, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  });

  function names(): string[] {
    return context.allFileData().map((f) => f.file);
  }

  async function eventually(
    what: string,
    condition: () => boolean,
    timeoutMs = 5000
  ) {
    const deadline = Date.now() + timeoutMs;
    while (!condition()) {
      if (Date.now() > deadline) {
        throw new Error(what);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
  }

  it('answers reads of an empty workspace instead of waiting for a scan that finished', () => {
    context = new WorkspaceContext(workspace, cacheDir);
    expect(context.allFileData()).toEqual([]);
    expect(context.allFileData()).toEqual([]);
    expect(context.glob(['**/*'])).toEqual([]);
  });

  it('keeps its files current from its own watcher', async () => {
    writeFileSync(join(workspace, 'a.ts'), 'a');
    context = new WorkspaceContext(workspace, cacheDir, { watch: true });
    expect(names()).toEqual(['a.ts']);
    const scanned = context.changeSeq();

    writeFileSync(join(workspace, 'b.ts'), 'b');
    await eventually('the write never reached the files', () =>
      names().includes('b.ts')
    );
    expect(context.changeSeq()).toBe(scanned + 1);

    rmSync(join(workspace, 'a.ts'));
    await eventually(
      'the delete never reached the files',
      () => !names().includes('a.ts')
    );
    expect(context.changeSeq()).toBe(scanned + 2);
  });

  it('reports a write made right after construction, during the scan', async () => {
    writeFileSync(join(workspace, 'seed.ts'), 'x');
    context = new WorkspaceContext(workspace, cacheDir, { watch: true });
    writeFileSync(join(workspace, 'boot.ts'), 'x');
    await eventually('a write during the boot scan went missing', () =>
      names().includes('boot.ts')
    );
  });

  it('settles a write made just before the call and hands the batch back once', async () => {
    writeFileSync(join(workspace, 'a.ts'), 'v0');
    context = new WorkspaceContext(workspace, cacheDir, { watch: true });
    context.allFileData();

    const heard: ChangeBatch[] = [];
    context.onChanges((err, batch) => {
      if (!err) heard.push(batch);
    });

    for (let i = 1; i <= 5; i++) {
      writeFileSync(join(workspace, 'a.ts'), `v${i}`);
      const batch = context.settle();
      // FSEvents may call a rewrite of a just-created file a create; either
      // way the batch names it and carries the new hash.
      const written = [...batch.createdFiles, ...batch.updatedFiles];
      expect(written.map((f) => f.file)).toEqual(['a.ts']);
      expect(context.allFileData()[0].hash).toBe(written[0].hash);
    }

    // The idle flush delivers to the subscriber; a settled batch does not.
    writeFileSync(join(workspace, 'b.ts'), 'b');
    await eventually('the subscriber never heard the idle flush', () =>
      heard.some((b) => b.createdFiles.some((f) => f.file === 'b.ts'))
    );
    expect(
      heard.flatMap((b) =>
        [...b.createdFiles, ...b.updatedFiles].map((f) => f.file)
      )
    ).not.toContain('a.ts');
  });

  it('delivers every event to the stream but applies only what a walk would keep', async () => {
    writeFileSync(join(workspace, '.gitignore'), 'dist/\n');
    writeFileSync(join(workspace, 'a.ts'), 'a');
    context = new WorkspaceContext(workspace, cacheDir, { watch: true });
    expect(names()).toEqual(['.gitignore', 'a.ts']);
    const scanned = context.changeSeq();

    const stream: WatchEvent[] = [];
    const applied: ChangeBatch[] = [];
    context.onWatchEvents((err, events) => {
      if (!err) stream.push(...events);
    });
    context.onChanges((err, batch) => {
      if (!err) applied.push(batch);
    });

    writeFileSync(join(workspace, 'dist'), '');
    rmSync(join(workspace, 'dist'));
    mkdirSync(join(workspace, 'dist'));
    writeFileSync(join(workspace, 'dist', 'out.js'), 'x');
    writeFileSync(join(workspace, 'b.ts'), 'b');
    await eventually('the stream never carried both writes', () =>
      ['dist/out.js', 'b.ts'].every((p) => stream.some((e) => e.path === p))
    );
    await eventually('the tracked write was never applied', () =>
      applied.some((b) => b.createdFiles.some((f) => f.file === 'b.ts'))
    );
    expect(names()).toEqual(['.gitignore', 'a.ts', 'b.ts']);
    expect(context.changeSeq()).toBe(scanned + 1);
    expect(
      applied.flatMap((b) => b.createdFiles.map((f) => f.file))
    ).not.toContain('dist/out.js');
  });
});
