import {
  cleanupProject,
  fileExists,
  newProject,
  removeFile,
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
        echo: {
          command: `cat libs/${lib}/src/index.ts libs/${lib}/generated/config.json && echo $NAME`,
        },
        // Same command; its bundle entry carries a glob that escapes the workspace.
        escaping: {
          command: `cat libs/${lib}/src/index.ts`,
          cache: true,
        },
        // Producer writes dist/out.txt from src; consumer reads it.
        produce: {
          command: `mkdir -p libs/${lib}/dist && cat libs/${lib}/src/index.ts > libs/${lib}/dist/out.txt`,
          cache: true,
          inputs: ['{projectRoot}/src/**/*'],
          outputs: ['{projectRoot}/dist'],
        },
        consume: {
          command: `cat libs/${lib}/dist/out.txt`,
          cache: true,
          dependsOn: ['produce'],
        },
        // Writes two files; only dist/main.txt is declared. dist/extra.txt is
        // added by the snapshot's observed outputs.
        writer: {
          command: `mkdir -p libs/${lib}/dist && echo main > libs/${lib}/dist/main.txt && echo extra > libs/${lib}/dist/extra.txt`,
          cache: true,
          inputs: ['{projectRoot}/src/**/*'],
          outputs: ['{projectRoot}/dist/main.txt'],
        },
      };
      return c;
    });
    updateFile(`libs/${lib}/README.md`, 'unread\n');
    // A generated, gitignored file the task reads: invisible to filesets,
    // visible to the snapshot.
    updateFile(`libs/${lib}/generated/config.json`, '{"v":1}\n');
    updateFile('.gitignore', (c) => `${c}\n**/generated/\n`);
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
          tasks: 4,
        },
        snapshots: {
          [taskId]: {
            commit: head,
            // Only what the command actually reads; README.md is not here.
            // Flat, workspace-relative collapsed globs (NXC-4847 §2b).
            inputs: [
              `libs/${project}/src/index.ts`,
              `libs/${project}/generated/config.json`,
            ],
            outputs: [],
          },
          [`${project}:escaping`]: {
            commit: head,
            inputs: ['../outside/**'],
            outputs: [],
          },
          // Observed reads inside the producer's outputs, but no taskOutputs:
          // the consumer must still be hashed after `produce` ran.
          [`${project}:consume`]: {
            commit: head,
            inputs: [`libs/${project}/dist/out.txt`],
            outputs: [],
          },
          [`${project}:writer`]: {
            commit: head,
            inputs: [`libs/${project}/src/index.ts`],
            outputs: [
              `libs/${project}/dist/main.txt`,
              `libs/${project}/dist/extra.txt`,
            ],
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
      .map(([file]) => file)
      .sort();
    expect(observed).toEqual([
      `libs/${lib}/generated/config.json`,
      `libs/${lib}/src/index.ts`,
    ]);
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

  it('hashes a gitignored generated file the snapshot says was read', () => {
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);
    updateFile(`libs/${lib}/generated/config.json`, '{"v":2}\n');
    expect(runCLI(`echo ${lib}`, { env: on })).not.toContain(CACHE_HIT);
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);
  }, 120000);

  it('still misses when an environment input changes', () => {
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);
    expect(
      runCLI(`echo ${lib}`, { env: { ...on, NAME: 'changed' } })
    ).not.toContain(CACHE_HIT);
  }, 120000);

  it('falls back when a bundle glob escapes the workspace', () => {
    const shown = JSON.parse(
      runCLI(`show target inputs ${lib}:escaping --json`, { env: on })
    );
    expect(shown.snapshot).toEqual({
      status: 'fallback',
      reason: 'escapes-workspace',
    });
    expect(shown.markers).toBeUndefined();
  });

  it('defers a consumer of dist/ reads until after its producer, even without taskOutputs', () => {
    // The bundle lists a read under produce's declared outputs but no
    // taskOutputs, so the backstop must (a) fold that path into consume's
    // snapshot inputs and (b) hash consume only after produce has written it.
    const shown = JSON.parse(
      runCLI(`show target inputs ${lib}:consume --json`, { env: on })
    );
    expect(shown.snapshot.status).toBe('used');
    expect(shown.files).toContain(`libs/${lib}/dist/out.txt`);
    expect(shown.sources[`libs/${lib}/dist/out.txt`]).toBe('snapshot');

    // Prime the cache, then change the producer's source: dist/out.txt changes,
    // so the consumer that hashes it must miss rather than reuse a stale key.
    runCLI(`consume ${lib}`, { env: on });
    expect(runCLI(`consume ${lib}`, { env: on })).toContain(CACHE_HIT);
    updateFile(`libs/${lib}/src/index.ts`, (c) => `${c}\n// produce again\n`);
    expect(runCLI(`consume ${lib}`, { env: on })).not.toContain(CACHE_HIT);
  }, 120000);

  it('adds a snapshot-observed output to a target and restores it from cache', () => {
    const shown = JSON.parse(
      runCLI(`show target outputs ${lib}:writer --json`, { env: on })
    );
    expect(shown.outputPaths).toEqual(
      expect.arrayContaining([
        `libs/${lib}/dist/main.txt`,
        `libs/${lib}/dist/extra.txt`,
      ])
    );
    expect(shown.sources[`libs/${lib}/dist/main.txt`]).toBe('declared');
    expect(shown.sources[`libs/${lib}/dist/extra.txt`]).toBe('snapshot');

    // Prime the cache, delete the undeclared file, replay: a hit restores it
    // because the snapshot added it to the task's outputs.
    runCLI(`writer ${lib}`, { env: on });
    removeFile(`libs/${lib}/dist/extra.txt`);
    expect(runCLI(`writer ${lib}`, { env: on })).toContain(CACHE_HIT);
    expect(fileExists(`${tmpProjPath()}/libs/${lib}/dist/extra.txt`)).toBe(
      true
    );
  }, 120000);

  it('does not add snapshot outputs when snapshots are off', () => {
    const shown = JSON.parse(
      runCLI(`show target outputs ${lib}:writer --json`, { env: off })
    );
    expect(shown.outputPaths).toEqual([`libs/${lib}/dist/main.txt`]);
    expect(shown.outputPaths).not.toContain(`libs/${lib}/dist/extra.txt`);
    // declared-only: printJson omits the all-declared sources map? it is present but all declared
    expect(shown.sources[`libs/${lib}/dist/main.txt`]).toBe('declared');
  }, 120000);

  it('hashes natively for a target that opts out with sandbox.enabled: false', () => {
    updateJson(`libs/${lib}/project.json`, (c) => {
      c.targets.echo.sandbox = { enabled: false };
      return c;
    });
    const shown = JSON.parse(
      runCLI(`show target inputs ${lib}:echo --json`, { env: on })
    );
    expect(shown.snapshot).toEqual({ status: 'fallback', reason: 'disabled' });
    expect(shown.markers).toBeUndefined();
    // Declared inputs again: the unread README is back in the hash.
    expect(runCLI(`echo ${lib}`, { env: on })).not.toContain(CACHE_HIT);
    expect(runCLI(`echo ${lib}`, { env: on })).toContain(CACHE_HIT);
    updateFile(`libs/${lib}/README.md`, 'opted out sees this\n');
    expect(runCLI(`echo ${lib}`, { env: on })).not.toContain(CACHE_HIT);
    updateJson(`libs/${lib}/project.json`, (c) => {
      delete c.targets.echo.sandbox;
      return c;
    });
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
