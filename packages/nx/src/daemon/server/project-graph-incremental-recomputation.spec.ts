import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:net';

import { TempFs } from '../../internal-testing-utils/temp-fs';
import { setWorkspaceRoot } from '../../utils/workspace-root';
import { watchWorkspace } from './watcher';
import { getWatcherInstance, storeWatcherInstance } from './shutdown-utils';
import {
  getCachedSerializedProjectGraphPromise,
  resetInternalState,
} from './project-graph-incremental-recomputation';
import { routeWorkspaceChanges } from './file-watching/route-workspace-changes';

describe('getCachedSerializedProjectGraphPromise — watcher race coverage', () => {
  let fs: TempFs;

  beforeEach(async () => {
    fs = new TempFs('pgir-race');
    await resetInternalState();
  });

  afterEach(async () => {
    const watcher = getWatcherInstance();
    if (watcher) await watcher.stop();
    fs.cleanup();
  });

  // Reproduces the spread-test flake shape end-to-end: write a new
  // project.json then immediately request the graph with no awaits
  // in between. If the daemon serves a stale cache, the new project
  // won't appear in the response — that's the bug. With the fix in
  // place the watcher pipeline delivers the event in time.
  it('returns a fresh graph reflecting an in-flight project add', async () => {
    fs.createFilesSync({
      'nx.json': JSON.stringify({}),
      'package.json': JSON.stringify({ name: 'root' }),
    });
    setWorkspaceRoot(fs.tempDir);

    const fakeServer = {} as unknown as Server;
    const watcher = await watchWorkspace(fakeServer, async (err, events) => {
      if (err || !events) return;
      routeWorkspaceChanges(events);
    });
    storeWatcherInstance(watcher);

    // First request — graph has no 'foo' project.
    const first = await getCachedSerializedProjectGraphPromise();
    expect(first.projectGraph?.nodes?.foo).toBeUndefined();

    // Add a project on disk and IMMEDIATELY request the graph —
    // no awaits, no sleeps. The watcher pipeline has to deliver
    // this event in time for the next compute to see it.
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
  });
});
