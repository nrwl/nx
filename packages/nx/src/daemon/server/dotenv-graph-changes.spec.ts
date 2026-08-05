import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProjectGraph } from '../../config/project-graph';
import { EventType } from '../../native';
import { setWorkspaceRoot, workspaceRoot } from '../../utils/workspace-root';
import {
  _resetDotEnvFileHashes,
  outputsChangeInvalidatesGraphEnv,
} from './dotenv-graph-changes';

describe('outputsChangeInvalidatesGraphEnv', () => {
  const originalWorkspaceRoot = workspaceRoot;
  let tempDir: string;

  const graphWithRoots = (roots: string[]): ProjectGraph =>
    ({
      nodes: Object.fromEntries(
        roots.map((root, i) => [`p${i}`, { data: { root } }])
      ),
    }) as any as ProjectGraph;

  beforeEach(() => {
    _resetDotEnvFileHashes();
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
      outputsChangeInvalidatesGraphEnv(
        [{ path: '.env.e2e', type: EventType.create }],
        undefined
      )
    ).toBe(true);
  });

  it('skips a byte-identical rewrite of a dotenv file', () => {
    write('.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const events = [{ path: '.env.e2e', type: EventType.update }];
    expect(outputsChangeInvalidatesGraphEnv(events, undefined)).toBe(true);
    expect(outputsChangeInvalidatesGraphEnv(events, undefined)).toBe(false);
  });

  it('invalidates again once the content actually changes', () => {
    write('.env.e2e', 'BASE_URL=http://localhost:4301\n');
    const events = [{ path: '.env.e2e', type: EventType.update }];
    expect(outputsChangeInvalidatesGraphEnv(events, undefined)).toBe(true);
    write('.env.e2e', 'BASE_URL=http://localhost:4302\n');
    expect(outputsChangeInvalidatesGraphEnv(events, undefined)).toBe(true);
  });

  it('invalidates on a changed project-root dotenv file', () => {
    write('apps/app1/.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toBe(true);
  });

  it('invalidates on a dotenv path whose identifier contains a slash', () => {
    // A target/configuration named with a slash makes getEnvPathsForTask emit a
    // path like apps/app1/.env.e2e/smoke; it must still match relative to the root.
    write('apps/app1/.env.e2e/smoke', 'BASE_URL=http://localhost:4301\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/.env.e2e/smoke', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toBe(true);
  });

  it('invalidates on a suffixed dotenv name', () => {
    write('apps/app1/.e2e.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/.e2e.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toBe(true);
  });

  it('invalidates on a suffixed dotenv path whose identifier contains a slash', () => {
    write('apps/app1/.e2e/smoke.env', 'BASE_URL=http://localhost:4301\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/.e2e/smoke.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toBe(true);
  });

  it('matches a parent-root dotenv when a nested root shadows the deepest dir', () => {
    // A project rooted at apps/app1/.env.e2e must not shadow the parent
    // apps/app1's slash-identifier dotenv (.env.e2e/smoke).
    write('apps/app1/.env.e2e/smoke', 'BASE_URL=http://localhost:4301\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/.env.e2e/smoke', type: EventType.create }],
        graphWithRoots(['apps/app1', 'apps/app1/.env.e2e'])
      )
    ).toBe(true);
  });

  it('ignores a dotenv file that sits under no root', () => {
    write('apps/app1/nested/.env', 'X=1\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: 'apps/app1/nested/.env', type: EventType.create }],
        graphWithRoots(['apps/app1'])
      )
    ).toBe(false);
  });

  it('ignores a dot-directory artifact with the dotenv name shape', () => {
    // `.{id}.env` with id `nx/cache/abc` has the dotenv name shape, but paths
    // like this are tool caches written constantly, not dotenv files.
    write('.nx/cache/abc.env', 'X=1\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: '.nx/cache/abc.env', type: EventType.create }],
        undefined
      )
    ).toBe(false);
  });

  it('ignores a workspace-root dotenv path whose identifier contains a slash', () => {
    // The cost of rejecting dot-directory artifacts: a workspace-root dotenv
    // for a `/`-containing target identifier no longer invalidates. Project
    // roots keep their slash identifiers via the root-ancestor walk.
    write('.env.e2e/smoke', 'X=1\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: '.env.e2e/smoke', type: EventType.create }],
        undefined
      )
    ).toBe(false);
  });

  it('ignores a non-dotenv file at a root', () => {
    write('.eslintrc.json', '{}\n');
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: '.eslintrc.json', type: EventType.update }],
        undefined
      )
    ).toBe(false);
  });

  it('invalidates when a root dotenv file is deleted', () => {
    expect(
      outputsChangeInvalidatesGraphEnv(
        [{ path: '.env', type: EventType.delete }],
        undefined
      )
    ).toBe(true);
  });
});
