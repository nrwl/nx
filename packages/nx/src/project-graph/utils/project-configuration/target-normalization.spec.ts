import { workspaceRoot } from '../../../utils/workspace-root';
import { normalizeTarget } from './target-normalization';

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
