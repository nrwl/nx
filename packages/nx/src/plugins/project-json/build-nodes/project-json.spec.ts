import * as memfs from 'memfs';

import '../../../internal-testing-utils/mock-fs';

import { ProjectJsonProjectsPlugin } from './project-json';
import { CreateNodesContext } from '../../../utils/nx-plugin';
const { createNodes } = ProjectJsonProjectsPlugin;

describe('nx project.json plugin', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      nxJsonConfiguration: {},
      workspaceRoot: '/root',
    };
  });

  it('should build projects from project.json', () => {
    memfs.vol.fromJSON(
      {
        'project.json': JSON.stringify({
          name: 'root',
          targets: { command: 'echo root project' },
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

    expect(createNodes[1]('project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          ".": {
            "name": "root",
            "root": ".",
            "targets": {
              "command": "echo root project",
            },
          },
        },
      }
    `);
    expect(createNodes[1]('packages/lib-a/project.json', undefined, context))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "packages/lib-a": {
            "name": "lib-a",
            "root": "packages/lib-a",
            "targets": {
              "build": {
                "executor": "nx:run-commands",
                "options": {},
              },
            },
          },
        },
      }
    `);
  });
});
