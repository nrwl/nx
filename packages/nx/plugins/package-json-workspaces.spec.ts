import * as memfs from 'memfs';

import '../src/utils/testing/mock-fs';
import { createNodeFromPackageJson } from './package-json-workspaces';

describe('nx package.json workspaces plugin', () => {
  it('should build projects from package.json files', () => {
    memfs.vol.fromJSON(
      {
        'package.json': JSON.stringify({
          name: 'root',
          scripts: { echo: 'echo root project' },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: { test: 'jest' },
        }),
        'packages/lib-b/package.json': JSON.stringify({
          name: 'lib-b',
          scripts: {
            build: 'tsc',
            test: 'jest',
            nonNxOperation: 'rm -rf .',
          },
          nx: {
            implicitDependencies: ['lib-a'],
            includedScripts: ['build', 'test'],
            targets: {
              build: {
                outputs: ['{projectRoot}/dist'],
              },
            },
          },
        }),
      },
      '/root'
    );

    expect(createNodeFromPackageJson('package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "root": {
            "name": "root",
            "projectType": "library",
            "root": ".",
            "sourceRoot": ".",
            "targets": {
              "echo": {
                "executor": "nx:run-script",
                "options": {
                  "script": "echo",
                },
              },
            },
          },
        },
      }
    `);
    expect(createNodeFromPackageJson('packages/lib-a/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-a": {
            "name": "lib-a",
            "projectType": "library",
            "root": "packages/lib-a",
            "sourceRoot": "packages/lib-a",
            "targets": {
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
    expect(createNodeFromPackageJson('packages/lib-b/package.json', '/root'))
      .toMatchInlineSnapshot(`
      {
        "projects": {
          "lib-b": {
            "implicitDependencies": [
              "lib-a",
            ],
            "includedScripts": [
              "build",
              "test",
            ],
            "name": "lib-b",
            "projectType": "library",
            "root": "packages/lib-b",
            "sourceRoot": "packages/lib-b",
            "targets": {
              "build": {
                "executor": "nx:run-script",
                "options": {
                  "script": "build",
                },
                "outputs": [
                  "{projectRoot}/dist",
                ],
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
