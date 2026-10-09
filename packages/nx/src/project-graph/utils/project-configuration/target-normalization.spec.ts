import '../../../internal-testing-utils/executor-schemas-from-source';

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

  describe('ultracache validation through the real merge pipeline', () => {
    // The root-map tests below construct shapes the pipeline cannot produce.
    // This one goes through mergeCreateNodesResults so a falsy ultracache is
    // proven to reach validation the way an authored project.json would.
    const resultsFor = (ultracache: unknown) => [
      [
        [
          'nx/core/project-json',
          'libs/a/ui/project.json',
          {
            projects: {
              'libs/a/ui': {
                name: 'a-ui',
                root: 'libs/a/ui',
                targets: { build: { executor: 'nx:run-commands', ultracache } },
              },
            },
          },
        ],
      ],
    ];

    // Escaping this call is what takes the daemon down: only the three
    // classifiable errors are collected, and `shutdown-utils` exits the
    // process for anything else.
    it('collects ultracache: false authored on a project instead of throwing', async () => {
      const { mergeCreateNodesResults } =
        await import('../project-configuration-utils');
      const errors: Error[] = [];

      expect(() =>
        mergeCreateNodesResults(
          resultsFor(false) as any,
          [],
          {} as any,
          tempFs.tempDir,
          errors
        )
      ).not.toThrow();

      expect(errors.map((e) => e.message)).toEqual([
        expect.stringMatching(/"ultracache" configuration for target "build"/),
      ]);
    });

    it('accepts a well-formed ultracache authored on a project', async () => {
      const { mergeCreateNodesResults } =
        await import('../project-configuration-utils');
      const errors: Error[] = [];

      expect(() =>
        mergeCreateNodesResults(
          resultsFor({ mode: 'off', ignoredReads: ['tmp/**'] }) as any,
          [],
          {} as any,
          tempFs.tempDir,
          errors
        )
      ).not.toThrow();

      expect(errors).toEqual([]);
    });
  });

  describe('ultracache validation', () => {
    const projectRootMapWithUltracache = (ultracache: unknown) => ({
      'libs/a/ui': {
        root: 'libs/a/ui',
        name: 'a-ui',
        targets: { build: { executor: 'nx:run-commands', ultracache } },
      },
    });

    // Aggregated as a WorkspaceValidityError so `mergeCreateNodesResults` can
    // classify it; a bespoke class escapes to the daemon.
    const ultracacheErrors = (ultracache: unknown): string[] => {
      try {
        validateAndNormalizeProjectRootMap(
          tempFs.tempDir,
          projectRootMapWithUltracache(ultracache) as any,
          {}
        );
      } catch (e) {
        expect(e).toBeInstanceOf(AggregateError);
        for (const inner of (e as AggregateError).errors) {
          expect(inner.name).toEqual('WorkspaceValidityError');
        }
        return (e as AggregateError).errors.map((inner) => inner.message);
      }
      return [];
    };

    it('should reject a non-object ultracache', () => {
      expect(ultracacheErrors(false)).toEqual([
        expect.stringMatching(
          /"ultracache" configuration for target "build" in project "a-ui"/
        ),
      ]);
    });

    it('should reject a string where a glob array is required', () => {
      expect(ultracacheErrors({ ignoredReads: 'tmp/**' })).toEqual([
        expect.stringMatching(
          /"ultracache.ignoredReads" for target "build" in project "a-ui" must be an array of glob patterns, but it is a string/
        ),
      ]);
    });

    it('should reject a non-string element inside a glob array', () => {
      expect(ultracacheErrors({ ignoredWrites: ['ok/**', 7] })).toEqual([
        expect.stringMatching(
          /"ultracache.ignoredWrites\[1\]".*must be a glob pattern string/
        ),
      ]);
    });

    it('should reject a mode that is not one of the four', () => {
      expect(ultracacheErrors({ mode: 'enabled' })).toEqual([
        expect.stringMatching(
          /"ultracache.mode" for target "build" in project "a-ui" must be one of "on", "warn", "error", "off", but it is "enabled"/
        ),
      ]);
    });

    it('should reject a mode that is not a string', () => {
      expect(ultracacheErrors({ mode: false })).toEqual([
        expect.stringMatching(/"ultracache.mode".*but it is a boolean/),
      ]);
    });

    it.each(['on', 'warn', 'error', 'off'])('should accept mode %s', (mode) => {
      expect(ultracacheErrors({ mode })).toEqual([]);
    });

    it('should reject a key that is not an ultracache option', () => {
      expect(ultracacheErrors({ ignoreReads: ['tmp/**'] })).toEqual([
        expect.stringMatching(
          /"ultracache.ignoreReads" for target "build" in project "a-ui" is not an ultracache option/
        ),
      ]);
    });

    // A spread with no base to resolve against survives merging, so rejecting
    // it here would fail a config the merge deliberately let through.
    it('should accept the spread token as a key', () => {
      expect(ultracacheErrors({ '...': true, mode: 'warn' })).toEqual([]);
    });

    it('should report every malformed key in one error', () => {
      const [message] = ultracacheErrors({
        mode: 'enabled',
        ignoreReads: ['tmp/**'],
        ignoredReads: 'tmp/**',
        ignoredWrites: ['ok/**', 7],
      });

      expect(message).toMatch(
        /"ultracache.ignoreReads" .* is not an ultracache option/
      );
      expect(message).toMatch(/"ultracache.mode"/);
      expect(message).toMatch(/"ultracache.ignoredReads"/);
      expect(message).toMatch(/"ultracache.ignoredWrites\[1\]"/);
    });

    it('should accept a well-formed ultracache', () => {
      expect(
        ultracacheErrors({
          mode: 'warn',
          ignoredReads: ['tmp/**'],
          ignoredWrites: ['scratch/**'],
        })
      ).toEqual([]);
    });

    it('should accept a target with no ultracache', () => {
      expect(ultracacheErrors(undefined)).toEqual([]);
    });
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

describe('normalization against target defaults', () => {
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

  describe('cache', () => {
    it('should not read cache from a target-name key an executor key shadowed', () => {
      const target = normalize(
        // The executor key won outright, so the merged target carries its
        // `inputs` and never saw the `build` key's `cache`.
        { executor: '@nx/angular:webpack-browser', inputs: ['production'] },
        {
          build: { cache: true, inputs: ['production', '^production'] },
          '@nx/angular:webpack-browser': { inputs: ['production'] },
        }
      );

      expect(target.cache).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });

    it('should not read cache from a target-name key that lost for another reason', () => {
      // The name key's entry declares a foreign executor, so resolution
      // discarded it as incompatible rather than shadowing it.
      const target = normalize(
        { executor: '@nx/angular:webpack-browser' },
        { build: { cache: true, executor: '@nx/js:tsc' } }
      );

      expect(target.cache).toBeUndefined();
      expect(warn).not.toHaveBeenCalled();
    });

    it('should keep the cache that resolution decided', () => {
      const target = normalize(
        { executor: '@nx/angular:webpack-browser', cache: true },
        {
          build: { cache: false },
          '@nx/angular:webpack-browser': { cache: true },
        }
      );

      expect(target.cache).toBe(true);
    });
  });

  describe('continuity', () => {
    it('should take continuous from the executor schema', () => {
      const getExecutorInformation = vi
        .spyOn(executorUtils, 'getExecutorInformation')
        .mockReturnValue({ schema: { continuous: true } } as any);

      const target = normalize(
        { executor: '@nx/js:verdaccio' },
        { '@nx/js:verdaccio': { inputs: ['default'] } },
        'local-registry'
      );

      expect(target.continuous).toBe(true);

      getExecutorInformation.mockRestore();
    });

    it('should let a target opt out of the schema flag', () => {
      // `normalizeTarget` skips the schema lookup when `continuous` is present
      // on the target at all, and this executor does not resolve here without
      // the stub, so the stub is what makes the opt-out observable.
      const getExecutorInformation = vi
        .spyOn(executorUtils, 'getExecutorInformation')
        .mockReturnValue({ schema: { continuous: true } } as any);

      const target = normalize(
        { executor: '@nx/js:verdaccio', continuous: false },
        { '@nx/js:verdaccio': { inputs: ['default'] } },
        'local-registry'
      );

      expect(target.continuous).toBe(false);

      getExecutorInformation.mockRestore();
    });
  });
});
