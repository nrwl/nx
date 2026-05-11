import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TempFs } from '../../internal-testing-utils/temp-fs';

describe('getCachedSerializedProjectGraphPromise — watcher race coverage', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('pgir-race');
  });

  afterEach(() => {
    fs.cleanup();
  });

  // Reproduces the spread-test flake shape end-to-end: write a new
  // project.json then immediately request the graph with no awaits
  // in between. If the daemon serves a stale cache, the new project
  // won't appear in the response — that's the bug. With the fix,
  // the watcher pipeline delivers the event in time and the new
  // project is part of the returned graph.
  it('returns a fresh graph reflecting an in-flight project add', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
    });

    await jest.isolateModulesAsync(async () => {
      const { setWorkspaceRoot } = require('../../utils/workspace-root');
      setWorkspaceRoot(fs.tempDir);

      const { watchWorkspace } = require('./watcher');
      const { storeWatcherInstance } = require('./shutdown-utils');
      const {
        getCachedSerializedProjectGraphPromise,
      } = require('./project-graph-incremental-recomputation');
      const {
        routeWorkspaceChanges,
      } = require('./file-watching/route-workspace-changes');

      const fakeServer = {} as unknown as import('net').Server;
      const watcher = await watchWorkspace(
        fakeServer,
        async (err: unknown, events: { type: string; path: string }[]) => {
          if (err || !events) return;
          routeWorkspaceChanges(events);
        }
      );
      storeWatcherInstance(watcher);

      try {
        // First request — graph has no 'foo' project.
        const first = await getCachedSerializedProjectGraphPromise();
        expect(first.projectGraph?.nodes?.foo).toBeUndefined();

        // Pre-create the directory so writing the project.json is
        // synchronous and races as tightly as possible against the
        // request. mkdirSync itself fires a watcher event too, but
        // it's a directory event that gets filtered downstream.
        mkdirSync(join(fs.tempDir, 'libs', 'foo'), { recursive: true });
        writeFileSync(
          join(fs.tempDir, 'libs', 'foo', 'project.json'),
          JSON.stringify({ name: 'foo', root: 'libs/foo' })
        );
        const second = await getCachedSerializedProjectGraphPromise();

        // The smoking gun. Without the recv_timeout fix, the watcher
        // event could be missed and the daemon would re-serve the
        // first graph (no 'foo').
        expect(second.projectGraph?.nodes?.foo).toBeDefined();
        expect(second.projectGraph?.nodes?.foo?.data?.root).toBe('libs/foo');
      } finally {
        await watcher.stop();
      }
    });
  });
});
