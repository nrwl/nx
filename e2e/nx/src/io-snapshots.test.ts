import {
  cleanupProject,
  newProject,
  runCLI,
  runCommand,
  tmpProjPath,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Hashing against an I/O snapshot bundle seeded by hand under
 * .nx/cache/io-snapshots/<HEAD>/snapshots.json. No Nx Cloud, no network:
 * NX_IO_SNAPSHOTS=true enables the feature and the bundle is fresh enough
 * to be served from the cache.
 */
describe('I/O snapshots', () => {
  const CACHE_HIT = 'read the output from the cache';
  let lib: string;

  beforeAll(() => {
    newProject({ packages: ['@nx/js'] });
    lib = uniq('lib');
    runCLI(`generate @nx/js:lib libs/${lib} --no-interactive`);
    updateJson('nx.json', (c) => {
      c.targetDefaults = {
        ...c.targetDefaults,
        echo: {
          cache: true,
          inputs: ['default', { env: 'NAME' }],
        },
      };
      return c;
    });
    updateJson(`libs/${lib}/project.json`, (c) => {
      c.targets = {
        ...c.targets,
        echo: { command: `cat libs/${lib}/src/index.ts && echo $NAME` },
      };
      return c;
    });
    updateFile(`libs/${lib}/README.md`, 'unread\n');
    seedBundle(lib);
  });

  afterAll(() => cleanupProject());

  function headSha(): string {
    // fetch_io_snapshots resolves HEAD before consulting the cache and skips
    // entirely without one, so the workspace must be a repo with a commit.
    try {
      return runCommand('git rev-parse HEAD', { failOnError: true }).trim();
    } catch {
      runCommand(
        'git init -q && git add -A && git -c user.name=e2e -c user.email=e2e@nx.dev commit -qm init'
      );
      return runCommand('git rev-parse HEAD').trim();
    }
  }

  function seedBundle(project: string) {
    const head = headSha();
    const dir = join(tmpProjPath(), '.nx', 'cache', 'io-snapshots', head);
    mkdirSync(dir, { recursive: true });
    const taskId = `${project}:echo`;
    writeFileSync(
      join(dir, 'snapshots.json'),
      JSON.stringify({
        version: 1,
        resolution: {
          requestedCommit: head,
          commits: [head],
          sourceCommits: [head],
          digest: 'e2e-digest',
          fetchedAt: Date.now(),
          clientVersion: 'e2e',
          tasks: 1,
        },
        snapshots: {
          [taskId]: {
            commit: head,
            // Only the file the command actually reads; README.md is not here.
            inputs: {
              projects: { [project]: ['src/index.ts'] },
              workspace: [],
              taskOutputs: {},
            },
            outputs: [],
          },
        },
      })
    );
  }

  const on = { NX_IO_SNAPSHOTS: 'true', NAME: 'e2e' };
  const off = { NX_IO_SNAPSHOTS: 'false', NAME: 'e2e' };

  it('reports the snapshot status in nx show target --json', () => {
    const used = JSON.parse(
      runCLI(`show target inputs ${lib}:echo --json`, { env: on })
    );
    expect(used.snapshot).toEqual(
      expect.objectContaining({ status: 'used', digest: 'e2e-digest' })
    );
    // Only the observed read comes from the snapshot; nx.json & co stay native.
    const observed = Object.entries(used.sources)
      .filter(([, source]) => source === 'snapshot')
      .map(([file]) => file);
    expect(observed).toEqual([`libs/${lib}/src/index.ts`]);
    expect(used.files).not.toContain(`libs/${lib}/README.md`);
    expect(used.sources['nx.json']).toBe('native');
    expect(used.markers).toEqual(['io-snapshot:e2e-digest']);

    const none = JSON.parse(
      runCLI(`show target inputs ${lib}:echo --json`, { env: off })
    );
    expect(none.snapshot.status).toBe('none');
    expect(none.files).toEqual(
      expect.arrayContaining([`libs/${lib}/README.md`])
    );
    // printJson omits empty arrays.
    expect(none.markers).toBeUndefined();
  });

  it('hits the cache when an unread file changes and misses when a read file changes', () => {
    expect(runCLI(`echo ${lib}`, { env: on })).not.toContain(CACHE_HIT);
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);

    updateFile(`libs/${lib}/README.md`, 'still unread\n');
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);

    updateFile(`libs/${lib}/src/index.ts`, (c) => `${c}\n// read\n`);
    expect(runCLI(`echo ${lib}`, { env: on })).not.toContain(CACHE_HIT);
  }, 120000);

  it('still misses when an environment input changes', () => {
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);
    expect(
      runCLI(`echo ${lib}`, { env: { ...on, NAME: 'changed' } })
    ).not.toContain(CACHE_HIT);
  }, 120000);

  it('hashes natively when the kill switch is set', () => {
    expect(runCLI(`echo ${lib}`, { env: off })).not.toContain(CACHE_HIT);
    expect(runCLI(`echo ${lib}`, { env: off })).toContain(CACHE_HIT);
    // An unread file is still a declared input natively.
    updateFile(`libs/${lib}/README.md`, 'native sees this\n');
    expect(runCLI(`echo ${lib}`, { env: off })).not.toContain(CACHE_HIT);
    // Same as a workspace that never had snapshots: the native key is reused.
    expect(
      runCLI(`echo ${lib}`, { env: { NAME: 'e2e', NX_IO_SNAPSHOTS: '' } })
    ).toContain(CACHE_HIT);
  }, 120000);
});
