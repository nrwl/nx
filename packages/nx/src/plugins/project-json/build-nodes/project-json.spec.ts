import * as memfs from 'memfs';

import '../../../internal-testing-utils/mock-fs';

import { ProjectJsonProjectsPlugin } from './project-json';
import { CreateNodesContext } from '../../../project-graph/plugins';
const createNodes = ProjectJsonProjectsPlugin.createNodes!;

describe('nx project.json plugin', () => {
  let context: CreateNodesContext;
  beforeEach(() => {
    context = {
      nxJsonConfiguration: {},
      workspaceRoot: '/root',
    };
  });

  it('should build projects from project.json', async () => {
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

    expect(
      await createNodes[1](
        ['project.json', 'packages/lib-a/project.json'],
        undefined,
        context
      )
    ).toMatchInlineSnapshot(`
      [
        [
          "project.json",
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
          },
        ],
        [
          "packages/lib-a/project.json",
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
          },
        ],
      ]
    `);
  });
});
