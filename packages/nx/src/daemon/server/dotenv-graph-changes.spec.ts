import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProjectGraph } from '../../config/project-graph';
import { EventType } from '../../native';
import { setWorkspaceRoot, workspaceRoot } from '../../utils/workspace-root';
import {
  clearDotEnvFileHashes,
  _resetPendingDotEnvEvents,
  classifyDotEnvChanges,
  drainPendingDotEnvEvents,
  hasPendingDotEnvEvidence,
  hasRelevantPendingDotEnvEvidence,
  queuePendingDotEnvEvents,
} from './dotenv-graph-changes';

describe('classifyDotEnvChanges', () => {
  const originalWorkspaceRoot = workspaceRoot;
  let tempDir: string;

  const graphWithRoots = (roots: string[]): ProjectGraph =>
    ({
      nodes: Object.fromEntries(
        roots.map((root, i) => [`p${i}`, { data: { root } }])
      ),
    }) as any as ProjectGraph;

  beforeEach(() => {
    clearDotEnvFileHashes();
    tempDir = mkdtempSync(join(tmpdir(), 'nx-dotenv-watch-'));
    setWorkspaceRoot(tempDir);
  });

  afterEach(() => {
    setWorkspaceRoot(originalWorkspaceRoot);
    rmSync(tempDir, { recursive: true, force: true });
  });

  function write(rel: string, content: string): void {
    const abs = join(tempDir, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }

  it('invalidates on a changed workspace-root dotenv file', () => {
    write('.env.e2e', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: '.env.e2e', type: EventType.create }],
        undefined
      )
    ).toEqual({ invalidating: ['.env.e2e'], unclassified: [] });
  });

  it('skips a byte-identical rewrite of a dotenv file', () => {
    write('.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const events = [{ path: '.env.e2e', type: EventType.update }];
    expect(classifyDotEnvChanges(events, undefined)).toEqual({
      invalidating: ['.env.e2e'],
      unclassified: [],
    });
    expect(classifyDotEnvChanges(events, undefined)).toEqual({
      invalidating: [],
      unclassified: [],
    });
  });

  it('invalidates again once the content actually changes', () => {
    write('.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const events = [{ path: '.env.e2e', type: EventType.update }];
    expect(classifyDotEnvChanges(events, undefined)).toEqual({
      invalidating: ['.env.e2e'],
      unclassified: [],
    });
    write('.env.e2e', 'BASE_URL=http://localhost:4302\n');
    expect(classifyDotEnvChanges(events, undefined)).toEqual({
      invalidating: ['.env.e2e'],
      unclassified: [],
    });
  });

  it('invalidates on a changed project-root dotenv file', () => {
    write('apps/app1/.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toEqual({ invalidating: ['apps/app1/.env'], unclassified: [] });
  });

  it('leaves a project-root dotenv unclassified without a graph, then invalidates once a graph classifies it', () => {
    // The in-flight window: the daemon's first computation has not committed a
    // graph when the event arrives, so the root is unknown. The recomputation
    // replays the unclassified event before serving a graph.
    write('apps/app1/.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const event = { path: 'apps/app1/.env.e2e', type: EventType.update };
    expect(classifyDotEnvChanges([event], undefined)).toEqual({
      invalidating: [],
      unclassified: [event],
    });
    expect(
      classifyDotEnvChanges([event], graphWithRoots(['apps/app1']))
    ).toEqual({ invalidating: ['apps/app1/.env.e2e'], unclassified: [] });
  });

  it('invalidates on a dotenv path whose identifier contains a slash', () => {
    // A target/configuration named with a slash makes getEnvPathsForTask emit a
    // path like apps/app1/.env.e2e/smoke; it must still match relative to the root.
    write('apps/app1/.env.e2e/smoke', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.env.e2e/smoke', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toEqual({ invalidating: ['apps/app1/.env.e2e/smoke'], unclassified: [] });
  });

  it('invalidates on a suffixed dotenv name', () => {
    write('apps/app1/.e2e.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.e2e.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toEqual({ invalidating: ['apps/app1/.e2e.env'], unclassified: [] });
  });

  it('invalidates on a suffixed dotenv path whose identifier contains a slash', () => {
    write('apps/app1/.e2e/smoke.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.e2e/smoke.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toEqual({ invalidating: ['apps/app1/.e2e/smoke.env'], unclassified: [] });
  });

  it('matches a parent-root dotenv when a nested root shadows the deepest dir', () => {
    // A project rooted at apps/app1/.env.e2e must not shadow the parent
    // apps/app1's slash-identifier dotenv (.env.e2e/smoke).
    write('apps/app1/.env.e2e/smoke', 'BASE_URL=http://localhost:4301\n');
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.env.e2e/smoke', type: EventType.create }],
        graphWithRoots(['apps/app1', 'apps/app1/.env.e2e'])
      )
    ).toEqual({ invalidating: ['apps/app1/.env.e2e/smoke'], unclassified: [] });
  });

  it('does not invalidate on a dotenv file that sits under no root of the given graph', () => {
    write('apps/app1/nested/.env', 'X=1\n');
    const event = { path: 'apps/app1/nested/.env', type: EventType.create };
    expect(
      classifyDotEnvChanges([event], graphWithRoots(['apps/app1']))
    ).toEqual({ invalidating: [], unclassified: [event] });
  });

  it('does not invalidate on a dot-directory artifact with the dotenv name shape', () => {
    // `.{id}.env` with id `github/workflows/ci` has the dotenv name shape, but
    // paths like this are ordinary dot-directory files, not dotenv files. They
    // come back unclassified and a committed graph re-rejects them.
    write('.github/workflows/ci.env', 'X=1\n');
    const event = { path: '.github/workflows/ci.env', type: EventType.create };
    expect(classifyDotEnvChanges([event], undefined)).toEqual({
      invalidating: [],
      unclassified: [event],
    });
    expect(
      classifyDotEnvChanges([event], graphWithRoots(['apps/app1']))
    ).toEqual({ invalidating: [], unclassified: [event] });
  });

  it('does not invalidate on a workspace-root dotenv path whose identifier contains a slash', () => {
    // The cost of rejecting dot-directory artifacts: a workspace-root dotenv
    // for a `/`-containing target identifier never invalidates. Project
    // roots keep their slash identifiers via the root-ancestor walk.
    write('.env.e2e/smoke', 'X=1\n');
    const event = { path: '.env.e2e/smoke', type: EventType.create };
    expect(classifyDotEnvChanges([event], undefined)).toEqual({
      invalidating: [],
      unclassified: [event],
    });
  });

  it('invalidates a re-created file with unchanged bytes after its events went unclassified', () => {
    // A hash recorded while the root was known stops being proof once an event
    // for the path goes unclassified: the graph may have observed a different
    // state (e.g. the file's absence) in between.
    write('apps/app1/.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const graph = graphWithRoots(['apps/app1']);
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.env.e2e', type: EventType.update }],
        graph
      )
    ).toEqual({ invalidating: ['apps/app1/.env.e2e'], unclassified: [] });
    // The root is gone from the committed graph, so the delete goes
    // unclassified (and may be dropped at the next pre-serve replay).
    const deleteEvent = { path: 'apps/app1/.env.e2e', type: EventType.delete };
    expect(classifyDotEnvChanges([deleteEvent], undefined)).toEqual({
      invalidating: [],
      unclassified: [deleteEvent],
    });
    // Re-created with the same bytes once a graph knows the root again: the
    // previously recorded hash must not suppress the invalidation.
    expect(
      classifyDotEnvChanges(
        [{ path: 'apps/app1/.env.e2e', type: EventType.create }],
        graph
      )
    ).toEqual({ invalidating: ['apps/app1/.env.e2e'], unclassified: [] });
  });

  it('ignores a non-dotenv file at a root', () => {
    write('.eslintrc.json', '{}\n');
    expect(
      classifyDotEnvChanges(
        [{ path: '.eslintrc.json', type: EventType.update }],
        undefined
      )
    ).toEqual({ invalidating: [], unclassified: [] });
  });

  it('invalidates when a root dotenv file is deleted', () => {
    expect(
      classifyDotEnvChanges(
        [{ path: '.env', type: EventType.delete }],
        undefined
      )
    ).toEqual({ invalidating: ['.env'], unclassified: [] });
  });
});

describe('pending dotenv event queue', () => {
  const originalWorkspaceRoot = workspaceRoot;
  let tempDir: string;

  const graphWithRoots = (roots: string[]): ProjectGraph =>
    ({
      nodes: Object.fromEntries(
        roots.map((root, i) => [`p${i}`, { data: { root } }])
      ),
    }) as any as ProjectGraph;

  beforeEach(() => {
    clearDotEnvFileHashes();
    _resetPendingDotEnvEvents();
    tempDir = mkdtempSync(join(tmpdir(), 'nx-dotenv-queue-'));
    setWorkspaceRoot(tempDir);
  });

  afterEach(() => {
    setWorkspaceRoot(originalWorkspaceRoot);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('invalidates drained paths under a known root, deduplicated and cleared', () => {
    queuePendingDotEnvEvents(['apps/e2e/.env.e2e', 'dist/out/.env.report'], 1);
    queuePendingDotEnvEvents(['apps/e2e/.env.e2e'], 1);

    expect(drainPendingDotEnvEvents(graphWithRoots(['apps/e2e']), 1)).toEqual({
      invalidating: ['apps/e2e/.env.e2e'],
      overflowed: false,
    });
    expect(drainPendingDotEnvEvents(graphWithRoots(['apps/e2e']), 1)).toEqual({
      invalidating: [],
      overflowed: false,
    });
  });

  it('drops a path queued before the serving computation claimed its generation', () => {
    // The computation started (and so read the file) after the event was
    // queued, which is after the edit landed: recomputing again would be
    // redundant.
    queuePendingDotEnvEvents(['apps/e2e/.env.e2e'], 1);

    expect(drainPendingDotEnvEvents(graphWithRoots(['apps/e2e']), 2)).toEqual({
      invalidating: [],
      overflowed: false,
    });
  });

  it('invalidates at drain regardless of a recorded content hash, and drops it', () => {
    // The computation the drain chains to may read intermediate bytes the
    // watcher never reports separately, so a hash matching the current bytes
    // proves nothing about the graph being served: the drain must invalidate
    // and clear the hash so the next classified event invalidates too.
    const abs = join(tempDir, 'apps/app1/.env.e2e');
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, 'PORT=4201\n');
    const graph = graphWithRoots(['apps/app1']);
    const event = { path: 'apps/app1/.env.e2e', type: EventType.update };
    // Records the content hash.
    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });

    queuePendingDotEnvEvents([event.path], 1);
    expect(drainPendingDotEnvEvents(graph, 1)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      overflowed: false,
    });

    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });
  });

  it('reports overflow past the cap and resets the flag on drain', () => {
    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      1
    );

    expect(drainPendingDotEnvEvents(undefined, 1)).toEqual({
      invalidating: [],
      overflowed: true,
    });
    expect(drainPendingDotEnvEvents(undefined, 1)).toEqual({
      invalidating: [],
      overflowed: false,
    });
  });

  it('drops an overflow recorded before the serving computation claimed its generation', () => {
    // The lost events were lost at queue-attempt time, so a computation that
    // claimed a later generation read every affected file after those edits.
    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      1
    );

    expect(drainPendingDotEnvEvents(undefined, 2)).toEqual({
      invalidating: [],
      overflowed: false,
    });
  });

  it('reports pending evidence by generation without consuming it', () => {
    expect(hasPendingDotEnvEvidence(1)).toBe(false);

    queuePendingDotEnvEvents(['apps/e2e/.env.e2e'], 3);
    expect(hasPendingDotEnvEvidence(3)).toBe(true);
    // Non-consuming: the same call answers again, and the drain still sees
    // the entry.
    expect(hasPendingDotEnvEvidence(3)).toBe(true);
    expect(hasPendingDotEnvEvidence(4)).toBe(false);
    expect(drainPendingDotEnvEvents(graphWithRoots(['apps/e2e']), 3)).toEqual({
      invalidating: ['apps/e2e/.env.e2e'],
      overflowed: false,
    });
  });

  it('reports overflow as evidence under the same generation rule', () => {
    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      5
    );

    expect(hasPendingDotEnvEvidence(5)).toBe(true);
    expect(hasPendingDotEnvEvidence(6)).toBe(false);
    // Non-consuming: the drain still sees the overflow.
    expect(drainPendingDotEnvEvents(undefined, 5).overflowed).toBe(true);
  });

  it('reports relevant evidence only for paths under a root of the given graph', () => {
    queuePendingDotEnvEvents(['dist/out/.env.report'], 3);
    expect(
      hasRelevantPendingDotEnvEvidence(graphWithRoots(['apps/e2e']), 3)
    ).toBe(false);

    queuePendingDotEnvEvents(['apps/e2e/.env.e2e'], 3);
    expect(
      hasRelevantPendingDotEnvEvidence(graphWithRoots(['apps/e2e']), 3)
    ).toBe(true);
    expect(
      hasRelevantPendingDotEnvEvidence(graphWithRoots(['apps/e2e']), 4)
    ).toBe(false);
    // Non-consuming: the drain still sees both entries.
    expect(drainPendingDotEnvEvents(graphWithRoots(['apps/e2e']), 3)).toEqual({
      invalidating: ['apps/e2e/.env.e2e'],
      overflowed: false,
    });
  });

  it('reports overflow as relevant evidence regardless of roots', () => {
    // The lost events have no identity left to classify, so relevance cannot
    // be ruled out.
    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      5
    );

    expect(hasRelevantPendingDotEnvEvidence(graphWithRoots([]), 5)).toBe(true);
    expect(hasRelevantPendingDotEnvEvidence(graphWithRoots([]), 6)).toBe(false);
  });

  it('drops the recorded hash of a path lost to overflow', () => {
    // A lost path never reaches a drain, so a retained hash would suppress a
    // later byte-identical event even though the computation racing it may
    // have read intermediate bytes. The suppressible event can arrive before
    // any drain runs, so the hash must go at insertion time.
    const abs = join(tempDir, 'apps/app1/.env.e2e');
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, 'PORT=4201\n');
    const graph = graphWithRoots(['apps/app1']);
    const event = { path: 'apps/app1/.env.e2e', type: EventType.update };
    // Records the content hash.
    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });

    queuePendingDotEnvEvents(
      Array.from({ length: 1024 }, (_, i) => `dist/out/.env.${i}`),
      1
    );
    // Lost to overflow: only the generation stamp survives.
    queuePendingDotEnvEvents(['apps/app1/.env.e2e'], 1);

    // Same bytes, no drain in between: must still invalidate.
    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });
  });

  it('clears the hash of a never-queued path when a relevant overflow is drained', () => {
    // A path that invalidated directly never enters the queue, so neither the
    // insertion-time nor the per-entry drain deletion touches its hash. Once
    // events are lost, that hash could suppress a later event over
    // intermediate bytes read by the successor the drain forces.
    const abs = join(tempDir, 'apps/app1/.env.e2e');
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, 'PORT=4201\n');
    const graph = graphWithRoots(['apps/app1']);
    const event = { path: 'apps/app1/.env.e2e', type: EventType.update };
    // Records the content hash; the path stays out of the queue.
    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });

    queuePendingDotEnvEvents(
      Array.from({ length: 1025 }, (_, i) => `dist/out/.env.${i}`),
      1
    );
    expect(drainPendingDotEnvEvents(graph, 1).overflowed).toBe(true);

    expect(classifyDotEnvChanges([event], graph)).toEqual({
      invalidating: ['apps/app1/.env.e2e'],
      unclassified: [],
    });
  });
});
