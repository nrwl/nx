import * as memfs from 'memfs';

import '../../../src/internal-testing-utils/mock-fs';

import { TargetDefaultsPlugin } from './target-defaults-plugin';
import { CreateNodesContext } from '../../utils/nx-plugin';
const {
  createNodes: [, createNodesFn],
} = TargetDefaultsPlugin;

describe('nx project.json plugin', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      nxJsonConfiguration: {
        targetDefaults: {
          build: {
            dependsOn: ['^build'],
          },
        },
      },
      workspaceRoot: '/root',
    };
  });

  it('should add target default info to project json projects', () => {
    memfs.vol.fromJSON(
      {
        'project.json': JSON.stringify({
          name: 'root',
          targets: { echo: { command: 'echo root project' } },
        }),
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodesFn('project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "targets": {
              "build": {
                "dependsOn": [
                  "^build",
                ],
                Symbol(ONLY_MODIFIES_EXISTING_TARGET): true,
              },
            },
          },
        },
      }
    `);
    expect(createNodesFn('packages/lib-a/project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "targets": {
              "build": {
                "dependsOn": [
                  "^build",
                ],
              },
            },
          },
        },
      }
    `);
  });
});
