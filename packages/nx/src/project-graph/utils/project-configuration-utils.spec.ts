import { dirname } from 'path';
import { isProjectConfigurationsError } from '../error-types';
import { createNodesFromFiles, NxPluginV2 } from '../plugins';
import { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import {
  createProjectConfigurationsWithPlugins,
  mergeCreateNodesResults,
} from './project-configuration-utils';

describe('project-configuration-utils', () => {
  describe('mergeCreateNodesResults', () => {
    it('should work with clickup repo', () => {
      const {
        results,
        nxJsonConfiguration,
        workspaceRoot: root,
        errors,
      } = require('./__fixtures__/merge-create-nodes-args.json');
      const result = mergeCreateNodesResults(
        results,
        nxJsonConfiguration,
        root,
        errors
      );
      const projectConfig = result.projectRootMap['apps/ovm-compactor'];
      const targetConfig = projectConfig['targets']?.['gradle-test'];
      const dependsOn = targetConfig?.dependsOn;
      expect(dependsOn).toMatchInlineSnapshot(`
        [
          "ovm-compactor:compileTestJava",
          "ovm-compactor:testClasses",
          "ovm-compactor:classes",
          "ovm-compactor:compileJava",
          "kafka-stream:jar",
          "split-client:jar",
        ]
      `);
    });
  });

  describe('createProjectConfigurations', () => {
    /* A fake plugin that sets `fake-lib` tag to libs. */
    const fakeTagPlugin: NxPluginV2 = {
      name: 'fake-tag-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (vitestConfigPaths) =>
          createNodesFromFiles(
            (vitestConfigPath) => {
              const [_libs, name, _config] = vitestConfigPath.split('/');
              return {
                projects: {
                  [name]: {
                    name: name,
                    root: `libs/${name}`,
                    tags: ['fake-lib'],
                  },
                },
              };
            },
            vitestConfigPaths,
            null,
            null
          ),
      ],
    };

    const fakeTargetsPlugin: NxPluginV2 = {
      name: 'fake-targets-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (projectJsonPaths) =>
          createNodesFromFiles(
            (projectJsonPath) => {
              const root = dirname(projectJsonPath);
              return {
                projects: {
                  [root]: {
                    root,
                    targets: {
                      build: {
                        executor: 'nx:run-commands',
                        options: {
                          command: 'echo {projectName} @ {projectRoot}',
                        },
                      },
                    },
                  },
                },
              };
            },
            projectJsonPaths,
            null,
            null
          ),
      ],
    };

    const sameNamePlugin: NxPluginV2 = {
      name: 'same-name-plugin',
      createNodesV2: [
        'libs/*/project.json',
        (projectJsonPaths) =>
          createNodesFromFiles(
            (projectJsonPath) => {
              const root = dirname(projectJsonPath);
              return {
                projects: {
                  [root]: {
                    root,
                    name: 'same-name',
                  },
                },
              };
            },
            projectJsonPaths,
            null,
            null
          ),
      ],
    };

    it('should create nodes for files matching included patterns only', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          [['libs/a/project.json', 'libs/b/project.json']],
          [
            new LoadedNxPlugin(fakeTagPlugin, {
              plugin: fakeTagPlugin.name,
            }),
          ]
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
        'libs/b': {
          name: 'b',
          root: 'libs/b',
          tags: ['fake-lib'],
        },
      });
    });

    it('should create nodes for files matching included patterns only', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          [['libs/a/project.json', 'libs/b/project.json']],
          [
            new LoadedNxPlugin(fakeTagPlugin, {
              plugin: fakeTagPlugin.name,
              include: ['libs/a/**'],
            }),
          ]
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
      });
    });

    it('should not create nodes for files matching excluded patterns', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          [['libs/a/project.json', 'libs/b/project.json']],
          [
            new LoadedNxPlugin(fakeTagPlugin, {
              plugin: fakeTagPlugin.name,
              exclude: ['libs/b/**'],
            }),
          ]
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
      });
    });

    it('should normalize targets', async () => {
      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/a/project.json'], ['libs/a/project.json']],
        [
          new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
          new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
        ]
      );
      expect(projects['libs/a'].targets.build).toMatchInlineSnapshot(`
        {
          "configurations": {},
          "executor": "nx:run-commands",
          "options": {
            "command": "echo a @ libs/a",
          },
          "parallelism": true,
        }
      `);
    });

    it('should validate that project names are unique', async () => {
      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/a/project.json', 'libs/b/project.json', 'libs/c/project.json']],
        [new LoadedNxPlugin(sameNamePlugin, 'same-name-plugin')]
      ).catch((e) => e);
      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors).toMatchInlineSnapshot(`
          [
            [MultipleProjectsWithSameNameError: The following projects are defined in multiple locations:
          - same-name: 
            - libs/a
            - libs/b
            - libs/c

          To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name.],
          ]
        `);
      }
    });

    it('should validate that projects have a name', async () => {
      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/a/project.json', 'libs/b/project.json', 'libs/c/project.json']],
        [new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin')]
      ).catch((e) => e);
      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors).toMatchInlineSnapshot(`
          [
            [ProjectsWithNoNameError: The projects in the following directories have no name provided:
            - libs/a
            - libs/b
            - libs/c],
          ]
        `);
      }
    });

    it('should provide helpful error if project has task containing cache and continuous', async () => {
      const invalidCachePlugin: NxPluginV2 = {
        name: 'invalid-cache-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) => {
            const results = [];
            for (const projectJsonPath of projectJsonPaths) {
              const root = dirname(projectJsonPath);
              const name = root.split('/')[1];
              results.push([
                projectJsonPath,
                {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        build: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo foo',
                          },
                          cache: true,
                          continuous: true,
                        },
                      },
                    },
                  },
                },
              ] as const);
            }
            return results;
          },
        ],
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/my-lib/project.json']],
        [new LoadedNxPlugin(invalidCachePlugin, 'invalid-cache-plugin')]
      ).catch((e) => e);

      const isErrorType = isProjectConfigurationsError(error);
      expect(isErrorType).toBe(true);
      if (isErrorType) {
        expect(error.errors.map((m) => m.toString())).toMatchInlineSnapshot(`
          [
            "[Configuration Error]:
          Errors detected in targets of project "my-lib":
          - "build" has both "cache" and "continuous" set to true. Continuous targets cannot be cached. Please remove the "cache" property.",
          ]
        `);
      }
    });

    it('should correctly set source maps', async () => {
      const { sourceMaps } = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/a/project.json'], ['libs/a/project.json']],
        [
          new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
          new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
        ]
      );
      expect(sourceMaps).toMatchInlineSnapshot(`
        {
          "libs/a": {
            "name": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "root": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "tags": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "tags.fake-lib": [
              "libs/a/project.json",
              "fake-tag-plugin",
            ],
            "targets": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.executor": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.options": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
            "targets.build.options.command": [
              "libs/a/project.json",
              "fake-targets-plugin",
            ],
          },
        }
      `);
    });

    it('should include project and target context in error message when plugin returns invalid {workspaceRoot} token', async () => {
      const invalidTokenPlugin: NxPluginV2 = {
        name: 'invalid-token-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) =>
            createNodesFromFiles(
              (projectJsonPath) => {
                const root = dirname(projectJsonPath);
                const name = root.split('/')[1];
                return {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        build: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo foo/{workspaceRoot}/bar',
                          },
                        },
                      },
                    },
                  },
                };
              },
              projectJsonPaths,
              null,
              null
            ),
        ],
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        [['libs/my-app/project.json']],
        [new LoadedNxPlugin(invalidTokenPlugin, 'invalid-token-plugin')]
      ).catch((e) => e);

      expect(error.message).toContain(
        'The {workspaceRoot} token is only valid at the beginning of an option'
      );
      expect(error.message).toContain('libs/my-app:build');
    });

    it('should include nx.json context in error message when target defaults have invalid {workspaceRoot} token', async () => {
      const simplePlugin: NxPluginV2 = {
        name: 'simple-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (projectJsonPaths) =>
            createNodesFromFiles(
              (projectJsonPath) => {
                const root = dirname(projectJsonPath);
                const name = root.split('/')[1];
                return {
                  projects: {
                    [root]: {
                      name,
                      root,
                      targets: {
                        test: {
                          executor: 'nx:run-commands',
                          options: {
                            command: 'echo test',
                          },
                        },
                      },
                    },
                  },
                };
              },
              projectJsonPaths,
              null,
              null
            ),
        ],
      };

      const nxJsonWithInvalidDefaults = {
        targetDefaults: {
          test: {
            options: {
              config: 'path/{workspaceRoot}/config.json',
            },
          },
        },
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        nxJsonWithInvalidDefaults,
        [['libs/my-lib/project.json']],
        [new LoadedNxPlugin(simplePlugin, 'simple-plugin')]
      ).catch((e) => e);

      expect(error.message).toContain(
        'The {workspaceRoot} token is only valid at the beginning of an option'
      );
      expect(error.message).toContain('nx.json[targetDefaults]:test');
    });

    describe('negation pattern support', () => {
      it('should support negation patterns in exclude to re-include specific files', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a-e2e/project.json',
                'libs/b-e2e/project.json',
                'libs/toolkit-workspace-e2e/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['**/*-e2e/**', '!**/toolkit-workspace-e2e/**'],
              }),
            ]
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/toolkit-workspace-e2e': {
            name: 'toolkit-workspace-e2e',
            root: 'libs/toolkit-workspace-e2e',
            tags: ['fake-lib'],
          },
        });
      });

      it('should support negation patterns in include to exclude specific files', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/b/project.json',
                'libs/c/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['libs/**', '!libs/b/**'],
              }),
            ]
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle multiple negation patterns correctly', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/b/project.json',
                'libs/c/project.json',
                'libs/d/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['libs/**', '!libs/b/**', '!libs/c/**'],
              }),
            ]
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/b': {
            name: 'b',
            root: 'libs/b',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle starting with negation pattern in exclude', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/b/project.json',
                'libs/c/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['!libs/a/**'],
              }),
            ]
          );

        // Should exclude everything except libs/a (first pattern is negation)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle starting with negation pattern in include', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/b/project.json',
                'libs/c/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['!libs/b/**'],
              }),
            ]
          );

        // Should include everything except libs/b (first pattern is negation)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should maintain backward compatibility with non-negation patterns', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [['libs/a/project.json', 'libs/b/project.json']],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['libs/a/**'],
                exclude: ['libs/b/**'],
              }),
            ]
          );

        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle overlapping patterns with last match winning', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/a/special/project.json',
                'libs/b/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['libs/**', '!libs/a/**', 'libs/a/special/**'],
              }),
            ]
          );

        // Exclude all libs, except a, but re-exclude a/special (last match wins)
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
        });
      });

      it('should work with both include and exclude having negation patterns', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [
              [
                'libs/a/project.json',
                'libs/b/project.json',
                'libs/c/project.json',
                'libs/d/project.json',
              ],
            ],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['libs/**', '!libs/d/**'],
                exclude: ['libs/b/**', '!libs/c/**'],
              }),
            ]
          );

        // Include: a, b, c (all except d)
        // Exclude: b (but not c due to negation)
        // Result: a, c
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/c': {
            name: 'c',
            root: 'libs/c',
            tags: ['fake-lib'],
          },
        });
      });

      it('should handle empty arrays with negation support intact', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            [['libs/a/project.json', 'libs/b/project.json']],
            [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: [],
                exclude: [],
              }),
            ]
          );

        // Empty arrays should not filter anything
        expect(projectConfigurations.projects).toEqual({
          'libs/a': {
            name: 'a',
            root: 'libs/a',
            tags: ['fake-lib'],
          },
          'libs/b': {
            name: 'b',
            root: 'libs/b',
            tags: ['fake-lib'],
          },
        });
      });
    });
  });
});
