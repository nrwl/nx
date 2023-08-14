import * as memfs from 'memfs';

import '../src/utils/testing/mock-fs';
import { getNxProjectJsonPlugin } from './project-json';

describe('nx project.json plugin', () => {
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
            executor: 'nx:run-commands',
            options: {},
          },
        }),
      },
      '/root'
    );

    const plugin = getNxProjectJsonPlugin('/root');
    expect(plugin.createNodes[1]('project.json', null)).toMatchInlineSnapshot(`
      {
        "projects": {
          "root": {
            "name": "root",
            "root": ".",
            "targets": {
              "command": "echo root project",
            },
          },
        },
      }
    `);
    expect(plugin.createNodes[1]('packages/lib-a/project.json', null))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-a": {
            "name": "lib-a",
            "root": "packages/lib-a",
            "targets": {
              "executor": "nx:run-commands",
              "options": {},
            },
          },
        },
      }
    `);
  });
});
