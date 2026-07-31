import { TempFs } from '../../../internal-testing-utils/temp-fs';
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
