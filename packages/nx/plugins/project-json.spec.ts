import * as memfs from 'memfs';

import '../src/utils/testing/mock-fs';

import { PackageJson } from '../src/utils/package-json';

import {
  getNxProjectJsonPlugin,
  mergeNpmScriptsWithTargets,
} from './project-json';

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
            build: {
              executor: 'nx:run-commands',
              options: {},
            },
          },
        }),
        'packages/lib-a/package.json': JSON.stringify({
          name: 'lib-a',
          scripts: {
            build: 'should not see me',
            test: 'jest',
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
              "build": {
                "executor": "nx:run-commands",
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

  describe('mergeNpmScriptsWithTargets', () => {
    const packageJson: PackageJson = {
      name: 'my-app',
      version: '0.0.0',
      scripts: {
        build: 'echo 1',
      },
    };

    const packageJsonBuildTarget = {
      executor: 'nx:run-script',
      options: {
        script: 'build',
      },
    };

    it('should prefer project.json targets', () => {
      const projectJsonTargets = {
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo 2',
          },
        },
      };

      const result = mergeNpmScriptsWithTargets(
        packageJson,
        projectJsonTargets
      );
      expect(result).toEqual(projectJsonTargets);
    });

    it('should provide targets from project.json and package.json', () => {
      const projectJsonTargets = {
        clean: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo 2',
          },
        },
      };

      const result = mergeNpmScriptsWithTargets(
        packageJson,
        projectJsonTargets
      );
      expect(result).toEqual({
        ...projectJsonTargets,
        build: packageJsonBuildTarget,
      });
    });

    it('should contain extended options from nx property in package.json', () => {
      const result = mergeNpmScriptsWithTargets(
        {
          name: 'my-other-app',
          version: '',
          scripts: {
            build: 'echo 1',
          },
          nx: {
            targets: {
              build: {
                outputs: ['custom'],
              },
            },
          },
        },
        null
      );
      expect(result).toEqual({
        build: { ...packageJsonBuildTarget, outputs: ['custom'] },
      });
    });

    it('should work when project.json targets is null', () => {
      const result = mergeNpmScriptsWithTargets(packageJson, null);

      expect(result).toEqual({
        build: {
          executor: 'nx:run-script',
          options: {
            script: 'build',
          },
        },
      });
    });

    it("should work when project root is ''", () => {
      const result = mergeNpmScriptsWithTargets(
        {
          name: 'my-app',
          version: '',
          scripts: {
            test: 'echo testing',
          },
        },
        {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'echo hi' },
          },
        }
      );

      expect(result).toEqual({
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
        test: {
          executor: 'nx:run-script',
          options: { script: 'test' },
        },
      });
    });

    it('should ignore scripts that are not in includedScripts', () => {
      const result = mergeNpmScriptsWithTargets(
        {
          name: 'included-scripts-test',
          version: '',
          scripts: {
            test: 'echo testing',
            fail: 'exit 1',
          },
          nx: {
            includedScripts: ['test'],
          },
        },
        {
          build: {
            executor: 'nx:run-commands',
            options: { command: 'echo hi' },
          },
        }
      );

      expect(result).toEqual({
        build: {
          executor: 'nx:run-commands',
          options: { command: 'echo hi' },
        },
        test: {
          executor: 'nx:run-script',
          options: { script: 'test' },
        },
      });
    });
  });
});
