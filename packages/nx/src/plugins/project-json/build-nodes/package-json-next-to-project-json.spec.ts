import * as memfs from 'memfs';

import '../../../internal-testing-utils/mock-fs';

import { PackageJsonProjectsNextToProjectJsonPlugin } from './package-json-next-to-project-json';
import { CreateNodesContext } from '../../../project-graph/plugins';
const { createNodes } = PackageJsonProjectsNextToProjectJsonPlugin;

describe('nx project.json plugin', () => {
  let context: CreateNodesContext;
  let createNodesFunction = createNodes[1];

  beforeEach(() => {
    context = {
      nxJsonConfiguration: {},
      workspaceRoot: '/root',
      configFiles: [],
    };
  });

  it('should build projects from package.json next to project.json', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a project description',
        }),
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a project description',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a package description',
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
            "metadata": {
              "description": "lib-a package description",
              "targetGroups": {
                "NPM Scripts": [
                  "test",
                ],
              },
            },
            "name": "lib-a",
            "root": "packages/lib-a",
            "tags": [
              "npm:public",
            ],
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
                "metadata": {
                  "runCommand": "npm run test",
                  "scriptContent": "jest",
                },
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

  it('should not build package manager workspace projects from package.json next to project.json', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a project description',
          workspaces: ['packages/lib-a'],
        }),
        'packages/lib-a/project.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a project description',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          description: 'lib-a package description',
          scripts: {
            test: 'jest',
          },
        }),
      },
      '/root'
    );

    expect(
      createNodesFunction('packages/lib-a/project.json', undefined, context)
    ).toMatchInlineSnapshot(`{}`);
  });
});
