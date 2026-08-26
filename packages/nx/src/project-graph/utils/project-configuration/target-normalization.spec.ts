import type { MockInstance } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { TempFs } from '../../../internal-testing-utils/temp-fs';
import * as executorUtils from '../../../command-line/run/executor-utils';
import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { TargetConfiguration } from '../../../config/workspace-json-project-json';
import { output } from '../../../utils/output';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  normalizeTarget,
  validateAndNormalizeProjectRootMap,
} from './target-normalization';

describe('normalizeTarget', () => {
  it('should support {projectRoot}, {workspaceRoot}, and {projectName} tokens', () => {
    const config = {
      name: 'project',
      root: 'libs/project',
      targets: {
        foo: { command: 'echo {projectRoot}' },
      },
    };
    expect(normalizeTarget(config.targets.foo, config, workspaceRoot, {}, ''))
      .toMatchInlineSnapshot(`
      {
        "configurations": {},
        "executor": "nx:run-commands",
        "options": {
          "command": "echo libs/project",
        },
        "parallelism": true,
      }
    `);
  });
  it('should not mutate the target', () => {
    const config = {
      name: 'project',
      root: 'libs/project',
      targets: {
        foo: {
          executor: 'nx:noop',
          options: {
            config: '{projectRoot}/config.json',
          },
          configurations: {
            prod: {
              config: '{projectRoot}/config.json',
            },
          },
        },
        bar: {
          command: 'echo {projectRoot}',
          options: {
            config: '{projectRoot}/config.json',
          },
          configurations: {
            prod: {
              config: '{projectRoot}/config.json',
            },
          },
        },
      },
    };
    const originalConfig = JSON.stringify(config, null, 2);

    normalizeTarget(config.targets.foo, config, workspaceRoot, {}, '');
    normalizeTarget(config.targets.bar, config, workspaceRoot, {}, '');
    expect(JSON.stringify(config, null, 2)).toEqual(originalConfig);
  });
});

describe('validateAndNormalizeProjectRootMap', () => {
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('target-normalization');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should name unnamed projects from the name in project.json rather than the folder name', () => {
    // Simulates a single plugin run (e.g. `addPlugin` during generators)
    // where projects are inferred from config files other than project.json,
    // so no name is attached even though project.json files with unique
    // names exist on disk.
    tempFs.createFilesSync({
      'libs/a/ui/project.json': JSON.stringify({ name: 'a-ui' }),
      'libs/b/ui/project.json': JSON.stringify({ name: 'b-ui' }),
    });

    const projectRootMap = {
      'libs/a/ui': { root: 'libs/a/ui' },
      'libs/b/ui': { root: 'libs/b/ui' },
    };

    validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {});

    expect(projectRootMap['libs/a/ui'].name).toEqual('a-ui');
    expect(projectRootMap['libs/b/ui'].name).toEqual('b-ui');
  });

  it('should fall back to the folder name when project.json has no name', () => {
    tempFs.createFilesSync({
      'libs/a/ui/project.json': JSON.stringify({}),
    });

    const projectRootMap = {
      'libs/a/ui': { root: 'libs/a/ui' },
    };

    validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {});

    expect(projectRootMap['libs/a/ui'].name).toEqual('ui');
  });

  it('should fall back to the folder name when project.json cannot be parsed', () => {
    tempFs.createFilesSync({
      'libs/a/ui/project.json': 'not json',
    });

    const projectRootMap = {
      'libs/a/ui': { root: 'libs/a/ui' },
    };

    validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {});

    expect(projectRootMap['libs/a/ui'].name).toEqual('ui');
  });

  it('should still report projects whose project.json files declare the same name', () => {
    tempFs.createFilesSync({
      'libs/a/ui/project.json': JSON.stringify({ name: 'ui' }),
      'libs/b/ui/project.json': JSON.stringify({ name: 'ui' }),
    });

    const projectRootMap = {
      'libs/a/ui': { root: 'libs/a/ui' },
      'libs/b/ui': { root: 'libs/b/ui' },
    };

    expect(() =>
      validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {})
    ).toThrow(AggregateError);
  });

  it('should point a duplicate coming from a worktree at the directory to ignore', () => {
    // A worktree is a full checkout, so every project in it duplicates the one
    // it came from. Renaming is the wrong advice - the copy shouldn't be walked.
    const metadataDir = join(tempFs.tempDir, '.git', 'worktrees', 'wt');
    const checkout = join(tempFs.tempDir, '.claude', 'worktrees', 'wt');
    mkdirSync(metadataDir, { recursive: true });
    mkdirSync(checkout, { recursive: true });
    writeFileSync(join(metadataDir, 'gitdir'), `${join(checkout, '.git')}\n`);
    writeFileSync(join(checkout, '.git'), `gitdir: ${metadataDir}\n`);

    const projectRootMap = {
      'libs/ui': { name: 'ui', root: 'libs/ui' },
      '.claude/worktrees/wt/libs/ui': {
        name: 'ui',
        root: '.claude/worktrees/wt/libs/ui',
      },
    };

    let message = '';
    try {
      validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {});
    } catch (e) {
      message = (e as AggregateError).errors[0].message;
    }

    // The bare path also appears in the list of conflicting roots above, so
    // pin the advice line itself - matching the path alone passes with the
    // advice deleted entirely.
    expect(message).toContain(
      'add the following to the .gitignore in the workspace root:\n  /.claude/worktrees/wt'
    );
    expect(message).toContain('git worktrees nested in this workspace');
    // Nothing is left over, so the reader is not also told to rename anything.
    expect(message).not.toContain('Set a unique name');
  });

  it('should still ask for a rename for the duplicates a worktree does not explain', () => {
    const metadataDir = join(tempFs.tempDir, '.git', 'worktrees', 'wt');
    const checkout = join(tempFs.tempDir, '.claude', 'worktrees', 'wt');
    mkdirSync(metadataDir, { recursive: true });
    mkdirSync(checkout, { recursive: true });
    writeFileSync(join(metadataDir, 'gitdir'), `${join(checkout, '.git')}\n`);
    writeFileSync(join(checkout, '.git'), `gitdir: ${metadataDir}\n`);

    const projectRootMap = {
      'libs/ui': { name: 'ui', root: 'libs/ui' },
      '.claude/worktrees/wt/libs/ui': {
        name: 'ui',
        root: '.claude/worktrees/wt/libs/ui',
      },
      'apps/a': { name: 'dup', root: 'apps/a' },
      'apps/b': { name: 'dup', root: 'apps/b' },
    };

    let message = '';
    try {
      validateAndNormalizeProjectRootMap(tempFs.tempDir, projectRootMap, {});
    } catch (e) {
      message = (e as AggregateError).errors[0].message;
    }

    // `dup` is an ordinary collision listed alongside the worktree one, and
    // would otherwise be named and then left with no remedy.
    expect(message).toContain('git worktrees nested in this workspace');
    expect(message).toContain('The rest are not from worktrees.');
    expect(message).toContain('Set a unique name');
  });
});

describe('target-name cache fallback', () => {
  let warn: MockInstance;

  beforeEach(() => {
    warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
  });

  function normalize(
    target: TargetConfiguration,
    targetDefaults: NxJsonConfiguration['targetDefaults'],
    targetName = 'build'
  ) {
    const rootMap = {
      'libs/project': {
        name: 'project',
        root: 'libs/project',
        targets: { [targetName]: target },
      },
    };
    validateAndNormalizeProjectRootMap(workspaceRoot, rootMap, {
      targetDefaults,
    });
    return rootMap['libs/project'].targets[targetName];
  }

  it('should apply the target-name default when an executor default shadowed it', () => {
    const target = normalize(
      // The executor key won outright, so the merged target carries its
      // `inputs` but never saw the `build` key's `cache`.
      { executor: '@nx/angular:webpack-browser', inputs: ['production'] },
      {
        build: { cache: true, inputs: ['production', '^production'] },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBe(true);
  });

  it('should not override cache already resolved on the target', () => {
    const target = normalize(
      { executor: '@nx/angular:webpack-browser', cache: false },
      {
        build: { cache: true },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBe(false);
  });

  it('should not apply to continuous targets', () => {
    // `api` is deliberately outside the long-running name list, so only the
    // `continuous` clause can reject this.
    const target = normalize(
      { executor: 'nx:run-commands', continuous: true },
      { api: { cache: true }, 'nx:run-commands': { inputs: ['default'] } },
      'api'
    );

    expect(target.cache).toBeUndefined();
  });

  it.each(['serve', 'dev', 'start', 'build-watch', 'test:watch'])(
    'should not apply to %s, which the pre-23 guard excluded by name',
    (targetName) => {
      const target = normalize(
        { executor: 'nx:run-commands' },
        {
          [targetName]: { cache: true },
          'nx:run-commands': { inputs: ['default'] },
        },
        targetName
      );

      expect(target.cache).toBeUndefined();
    }
  );

  it('should read the last unfiltered entry of an array-shaped default', () => {
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: [
          { cache: false },
          // Later unfiltered entry wins, matching the in-key merge order.
          { cache: true },
        ],
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBe(true);
  });

  it('should restore nothing when a filtered entry decides cache', () => {
    // The filtered entry carries `cache: true` and the unfiltered one `false`,
    // so ignoring filters would restore caching. Whether the filter applies
    // can't be evaluated here, so the value is unknowable and nothing is done.
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: [
          { cache: false },
          { filter: { projects: ['project'] }, cache: true },
        ],
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBeUndefined();
  });

  it('should not materialize cache when the target-name default opts out', () => {
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: { cache: false },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBeUndefined();
  });

  it('should apply to a target that explicitly opts out of continuity', () => {
    // The schema is stubbed continuous so the opt-out is the only thing that
    // can decide this: `normalizeTarget` skips the lookup when `continuous` is
    // present on the target at all. Without the stub the executor simply fails
    // to resolve here, and the test would pass without exercising the opt-out.
    const getExecutorInformation = vi
      .spyOn(executorUtils, 'getExecutorInformation')
      .mockReturnValue({ schema: { continuous: true } } as any);

    const target = normalize(
      { executor: '@nx/js:verdaccio', continuous: false },
      {
        'local-registry': { cache: true },
        '@nx/js:verdaccio': { inputs: ['default'] },
      },
      'local-registry'
    );

    expect(target.continuous).toBe(false);
    expect(target.cache).toBe(true);

    getExecutorInformation.mockRestore();
  });

  it('should not apply when the executor schema makes the target continuous', () => {
    // The paired case: no explicit opt-out, so the schema decides and the
    // target is continuous. Caching it would be invalid.
    const getExecutorInformation = vi
      .spyOn(executorUtils, 'getExecutorInformation')
      .mockReturnValue({ schema: { continuous: true } } as any);

    const target = normalize(
      { executor: '@nx/js:verdaccio' },
      {
        'local-registry': { cache: true },
        '@nx/js:verdaccio': { inputs: ['default'] },
      },
      'local-registry'
    );

    expect(target.continuous).toBe(true);
    expect(target.cache).toBeUndefined();

    getExecutorInformation.mockRestore();
  });

  it('should not apply when no executor key shadowed the target name key', () => {
    // The name key's entry declares a foreign executor, so it was dropped as
    // incompatible rather than shadowed. Pre-23 this target WAS cacheable —
    // that derivation matched on target name alone and never read the entry's
    // `executor` — so this is a deliberate narrowing, not parity. Restoring it
    // would set `cache` with no key to name in the warning and no migration
    // able to retire it.
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      { build: { cache: true, executor: '@nx/js:tsc' } }
    );

    expect(target.cache).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('should warn naming the shadowing key and the key it was read from', () => {
    normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: { cache: true },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(warn).toHaveBeenCalledTimes(1);
    const bodyLines = warn.mock.calls[0][0].bodyLines.join('\n');
    expect(bodyLines).toContain(
      '"@nx/angular:webpack-browser" does not set "cache", so it was read from "build"'
    );
    // The deadline is load-bearing: the TODO(v24) markers on both halves assume
    // it, so the user-facing text has to name the same release.
    expect(bodyLines).toContain('will be removed in Nx 24');
  });

  it('should group the warning across projects and targets', () => {
    const rootMap = {
      'libs/a': {
        name: 'a',
        root: 'libs/a',
        targets: { build: { executor: '@nx/angular:webpack-browser' } },
      },
      'libs/b': {
        name: 'b',
        root: 'libs/b',
        targets: {
          build: { executor: '@nx/angular:webpack-browser' },
          test: { executor: '@nx/jest:jest' },
        },
      },
    };
    validateAndNormalizeProjectRootMap(workspaceRoot, rootMap, {
      targetDefaults: {
        build: { cache: true },
        test: { cache: true },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
        '@nx/jest:jest': { inputs: ['default'] },
      },
    });

    // Three shadowed targets across two projects, but only two distinct
    // (executor key, target key) pairs — and one warning.
    expect(warn).toHaveBeenCalledTimes(1);
    const bodyLines: string[] = warn.mock.calls[0][0].bodyLines;
    expect(
      bodyLines.filter((line) => line.includes('does not set "cache"'))
    ).toHaveLength(2);
  });

  it('should not warn when nothing was shadowed', () => {
    normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: { cache: true },
      }
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('should leave cache unset when no target-name default exists', () => {
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      { '@nx/angular:webpack-browser': { inputs: ['production'] } }
    );

    expect(target.cache).toBeUndefined();
  });

  it.each([
    ['an array entry that is null', JSON.parse('[null,{"cache":true}]')],
    ['a string', JSON.parse('"nonsense"')],
    ['a number', JSON.parse('7')],
  ])('should not throw when the target-name default is %s', (_label, build) => {
    // nx.json is hand-edited, and this runs inside graph construction — a
    // throw here fails every nx command, not just the fallback.
    expect(() =>
      normalize({ executor: '@nx/js:tsc' }, {
        build,
        '@nx/js:tsc': { inputs: ['default'] },
      } as any)
    ).not.toThrow();
  });

  it('should not treat an inherited key as a shadowing executor key', () => {
    // `targetDefaults["__proto__"]` resolves through the prototype chain to a
    // truthy object, so an unguarded lookup reports a shadowing key that the
    // user never wrote — restoring cache and naming it in the warning.
    const target = normalize(
      { executor: '__proto__' },
      { build: { cache: true } }
    );

    expect(target.cache).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('should not restore cache when the target-name key declares none', () => {
    // The most common nx.json shape there is: a name key carrying only
    // dependsOn/inputs alongside an executor key. Nothing opted in, so nothing
    // is restored.
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: { dependsOn: ['^build'] },
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('should stop at a filtered entry rather than read past it to a later one', () => {
    // Reading past the filter would find the unfiltered `cache: true` and
    // restore caching for a project the filter may never have covered.
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: [
          { filter: { projects: ['legacy-app'] }, cache: false },
          { cache: true },
        ],
        '@nx/angular:webpack-browser': { inputs: ['production'] },
      }
    );

    expect(target.cache).toBeUndefined();
  });
});
