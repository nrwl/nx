import * as memfs from 'memfs';

import '../../../internal-testing-utils/mock-fs';

import { PackageJsonProjectsNextToProjectJsonPlugin } from './package-json-next-to-project-json';
import { CreateNodesContext } from '../../../utils/nx-plugin';
const { createNodes } = PackageJsonProjectsNextToProjectJsonPlugin;

describe('nx project.json plugin', () => {
  let context: CreateNodesContext;
  let createNodesFunction = createNodes[1];

  beforeEach(() => {
    context = {
      nxJsonConfiguration: {},
      workspaceRoot: '/root',
    };
  });

  it('should build projects from project.json', () => {
    memfs.vol.fromJSON(
      {
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            test: 'jest',
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFunction('packages/lib-a/project.json', undefined, context)
    ).toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-a": {
            "name": "lib-a",
            "root": "packages/lib-a",
            "targets": {
              "nx-release-publish": {
                "dependsOn": [
                  "^nx-release-publish",
                ],
                "executor": "@nx/js:release-publish",
                "options": {},
              },
              "test": {
                "executor": "nx:run-script",
                "options": {
                  "script": "test",
                },
              },
            },
          },
        },
      }
    `);
  });
});
