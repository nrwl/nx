import { TempFs } from '../../../internal-testing-utils/temp-fs';
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
});

describe('target-name cache fallback', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(output, 'warn').mockImplementation(() => {});
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
    const target = normalize(
      { executor: 'nx:run-commands', continuous: true },
      { serve: { cache: true }, 'nx:run-commands': { inputs: ['default'] } },
      'serve'
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
    // Whether the per-project opt-out applies can't be evaluated here, so the
    // value is unknowable and nothing is restored.
    const target = normalize(
      { executor: '@nx/angular:webpack-browser' },
      {
        build: [
          { cache: true },
          { filter: { projects: ['project'] }, cache: false },
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

  it('should not apply when no executor key shadowed the target name key', () => {
    // The name key's entry declares a foreign executor, so it was dropped as
    // incompatible rather than shadowed. Nothing to restore, nothing to warn.
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
    expect(warn.mock.calls[0][0].bodyLines.join('\n')).toContain(
      '"@nx/angular:webpack-browser" does not set "cache", so it was read from "build"'
    );
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
});
