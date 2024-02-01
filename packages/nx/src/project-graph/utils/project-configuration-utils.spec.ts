import { ONLY_MODIFIES_EXISTING_TARGET } from '../../plugins/target-defaults/target-defaults-plugin';
import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import {
  ConfigurationSourceMaps,
  isCompatibleTarget,
  mergeProjectConfigurationIntoRootMap,
  mergeTargetConfigurations,
  readProjectConfigurationsFromRootMap,
  readTargetDefaultsForTarget,
} from './project-configuration-utils';

describe('project-configuration-utils', () => {
  describe('target merging', () => {
    const targetDefaults = {
      'nx:run-commands': {
        options: {
          key: 'default-value-for-executor',
        },
      },
      build: {
        options: {
          key: 'default-value-for-targetname',
        },
      },
    };

    it('should prefer executor key', () => {
      expect(
        readTargetDefaultsForTarget(
          'other-target',
          targetDefaults,
          'nx:run-commands'
        ).options['key']
      ).toEqual('default-value-for-executor');
    });

    it('should fallback to target key', () => {
      expect(
        readTargetDefaultsForTarget('build', targetDefaults, 'other-executor')
          .options['key']
      ).toEqual('default-value-for-targetname');
    });

    it('should return undefined if not found', () => {
      expect(
        readTargetDefaultsForTarget(
          'other-target',
          targetDefaults,
          'other-executor'
        )
      ).toBeNull();
    });

    it('should not merge top level properties for incompatible targets', () => {
      expect(
        mergeTargetConfigurations(
          {
            executor: 'target2',
            outputs: ['output1'],
          },
          {
            executor: 'target',
            inputs: ['input1'],
          }
        )
      ).toEqual({ executor: 'target2', outputs: ['output1'] });
    });

    describe('options', () => {
      it('should merge if executor matches', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                a: 'project-value-a',
              },
            },
            {
              executor: 'target',
              options: {
                a: 'default-value-a',
                b: 'default-value-b',
              },
            }
          ).options
        ).toEqual({ a: 'project-value-a', b: 'default-value-b' });
      });

      it('should merge if executor is only provided on the project', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                a: 'project-value',
              },
            },
            {
              options: {
                a: 'default-value',
                b: 'default-value',
              },
            }
          ).options
        ).toEqual({ a: 'project-value', b: 'default-value' });
      });

      it('should merge if executor is only provided in the defaults', () => {
        expect(
          mergeTargetConfigurations(
            {
              options: {
                a: 'project-value',
              },
            },
            {
              executor: 'target',
              options: {
                a: 'default-value',
                b: 'default-value',
              },
            }
          ).options
        ).toEqual({ a: 'project-value', b: 'default-value' });
      });

      it('should not merge if executor is different', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'other',
              options: {
                a: 'project-value',
              },
            },
            {
              executor: 'default-executor',
              options: {
                b: 'default-value',
              },
            }
          ).options
        ).toEqual({ a: 'project-value' });
      });
    });

    describe('configurations', () => {
      const projectConfigurations: TargetConfiguration['configurations'] = {
        dev: {
          foo: 'project-value-foo',
        },
        prod: {
          bar: 'project-value-bar',
        },
      };

      const defaultConfigurations: TargetConfiguration['configurations'] = {
        dev: {
          foo: 'default-value-foo',
          other: 'default-value-other',
        },
        baz: {
          x: 'default-value-x',
        },
      };

      const merged: TargetConfiguration['configurations'] = {
        dev: {
          foo: projectConfigurations.dev.foo,
          other: defaultConfigurations.dev.other,
        },
        prod: { bar: projectConfigurations.prod.bar },
        baz: { x: defaultConfigurations.baz.x },
      };

      it('should merge configurations if executor matches', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: projectConfigurations,
            },
            {
              executor: 'target',
              configurations: defaultConfigurations,
            }
          ).configurations
        ).toEqual(merged);
      });

      it('should merge if executor is only provided on the project', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: projectConfigurations,
            },
            {
              configurations: defaultConfigurations,
            }
          ).configurations
        ).toEqual(merged);
      });

      it('should merge if executor is only provided in the defaults', () => {
        expect(
          mergeTargetConfigurations(
            {
              configurations: projectConfigurations,
            },
            {
              executor: 'target',
              configurations: defaultConfigurations,
            }
          ).configurations
        ).toEqual(merged);
      });

      it('should not merge if executor doesnt match', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'other',
              configurations: projectConfigurations,
            },
            {
              executor: 'target',
              configurations: defaultConfigurations,
            }
          ).configurations
        ).toEqual(projectConfigurations);
      });
    });

    describe('defaultConfiguration', () => {
      const projectDefaultConfiguration: TargetConfiguration['defaultConfiguration'] =
        'dev';
      const defaultDefaultConfiguration: TargetConfiguration['defaultConfiguration'] =
        'prod';

      const merged: TargetConfiguration['defaultConfiguration'] =
        projectDefaultConfiguration;

      it('should merge defaultConfiguration if executor matches', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              defaultConfiguration: projectDefaultConfiguration,
            },
            {
              executor: 'target',
              defaultConfiguration: defaultDefaultConfiguration,
            }
          ).defaultConfiguration
        ).toEqual(merged);
      });

      it('should merge if executor is only provided on the project', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'target',
              defaultConfiguration: projectDefaultConfiguration,
            },
            {
              defaultConfiguration: defaultDefaultConfiguration,
            }
          ).defaultConfiguration
        ).toEqual(merged);
      });

      it('should merge if executor is only provided in the defaults', () => {
        expect(
          mergeTargetConfigurations(
            {
              defaultConfiguration: projectDefaultConfiguration,
            },
            {
              executor: 'target',
              defaultConfiguration: defaultDefaultConfiguration,
            }
          ).defaultConfiguration
        ).toEqual(merged);
      });

      it('should not merge if executor doesnt match', () => {
        expect(
          mergeTargetConfigurations(
            {
              executor: 'other',
              defaultConfiguration: projectDefaultConfiguration,
            },
            {
              executor: 'target',
              defaultConfiguration: defaultDefaultConfiguration,
            }
          ).defaultConfiguration
        ).toEqual(projectDefaultConfiguration);
      });
    });

    describe('run-commands', () => {
      it('should merge two run-commands targets appropriately', () => {
        const merged = mergeTargetConfigurations(
          {
            outputs: ['{projectRoot}/outputfile.json'],
            options: {
              command: 'eslint . -o outputfile.json',
            },
          },
          {
            cache: true,
            inputs: [
              'default',
              '{workspaceRoot}/.eslintrc.json',
              '{workspaceRoot}/apps/third-app/.eslintrc.json',
              '{workspaceRoot}/tools/eslint-rules/**/*',
              { externalDependencies: ['eslint'] },
            ],
            options: { cwd: 'apps/third-app', command: 'eslint .' },
            executor: 'nx:run-commands',
            configurations: {},
          }
        );
        expect(merged).toMatchInlineSnapshot(`
          {
            "cache": true,
            "configurations": {},
            "executor": "nx:run-commands",
            "inputs": [
              "default",
              "{workspaceRoot}/.eslintrc.json",
              "{workspaceRoot}/apps/third-app/.eslintrc.json",
              "{workspaceRoot}/tools/eslint-rules/**/*",
              {
                "externalDependencies": [
                  "eslint",
                ],
              },
            ],
            "options": {
              "command": "eslint . -o outputfile.json",
              "cwd": "apps/third-app",
            },
            "outputs": [
              "{projectRoot}/outputfile.json",
            ],
          }
        `);
      });

      it('should merge targets when the base uses command syntactic sugar', () => {
        const merged = mergeTargetConfigurations(
          {
            outputs: ['{projectRoot}/outputfile.json'],
            options: {
              command: 'eslint . -o outputfile.json',
            },
          },
          {
            cache: true,
            inputs: [
              'default',
              '{workspaceRoot}/.eslintrc.json',
              '{workspaceRoot}/apps/third-app/.eslintrc.json',
              '{workspaceRoot}/tools/eslint-rules/**/*',
              { externalDependencies: ['eslint'] },
            ],
            options: { cwd: 'apps/third-app' },
            configurations: {},
            command: 'eslint .',
          }
        );
        expect(merged).toMatchInlineSnapshot(`
          {
            "cache": true,
            "command": "eslint .",
            "configurations": {},
            "inputs": [
              "default",
              "{workspaceRoot}/.eslintrc.json",
              "{workspaceRoot}/apps/third-app/.eslintrc.json",
              "{workspaceRoot}/tools/eslint-rules/**/*",
              {
                "externalDependencies": [
                  "eslint",
                ],
              },
            ],
            "options": {
              "command": "eslint . -o outputfile.json",
              "cwd": "apps/third-app",
            },
            "outputs": [
              "{projectRoot}/outputfile.json",
            ],
          }
        `);
      });
    });

    describe('cache', () => {
      it('should not be merged for incompatible targets', () => {
        const result = mergeTargetConfigurations(
          {
            executor: 'foo',
          },
          {
            executor: 'bar',
            cache: true,
          }
        );
        expect(result.cache).not.toBeDefined();
      });
    });
  });

  describe('mergeProjectConfigurationIntoRootMap', () => {
    it('should merge targets from different configurations', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            echo: {
              command: 'echo lib-a',
            },
          },
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            command: 'tsc',
          },
        },
      });
      expect(rootMap.get('libs/lib-a')).toMatchInlineSnapshot(`
        {
          "name": "lib-a",
          "root": "libs/lib-a",
          "targets": {
            "build": {
              "executor": "nx:run-commands",
              "options": {
                "command": "tsc",
              },
            },
            "echo": {
              "command": "echo lib-a",
            },
          },
        }
      `);
    });

    // Target configuration merging is tested more thoroughly in mergeTargetConfigurations
    it('should merge target configurations of compatible target declarations', () => {
      const existingTargetConfiguration = {
        command: 'already present',
      };
      const shouldMergeConfigurationA = {
        executor: 'build',
        options: {
          a: 1,
          b: {
            c: 2,
          },
        },
        configurations: {
          dev: {
            foo: 'bar',
          },
          prod: {
            optimize: true,
          },
        },
      };
      const shouldMergeConfigurationB = {
        executor: 'build',
        options: {
          d: 3,
          b: {
            c: 2,
          },
        },
        configurations: {
          prod: {
            foo: 'baz',
          },
        },
      };
      const shouldntMergeConfigurationA = {
        executor: 'build',
        options: {
          a: 1,
        },
      };
      const shouldntMergeConfigurationB = {
        executor: 'test',
        options: {
          test: 1,
        },
      };
      const newTargetConfiguration = {
        executor: 'echo',
        options: {
          echo: 'echo',
        },
      };

      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            existingTarget: existingTargetConfiguration,
            shouldMerge: shouldMergeConfigurationA,
            shouldntMerge: shouldntMergeConfigurationA,
          },
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          shouldMerge: shouldMergeConfigurationB,
          shouldntMerge: shouldntMergeConfigurationB,
          newTarget: newTargetConfiguration,
        },
      });
      const merged = rootMap.get('libs/lib-a');
      expect(merged.targets['existingTarget']).toEqual(
        existingTargetConfiguration
      );
      expect(merged.targets['shouldMerge']).toMatchInlineSnapshot(`
        {
          "configurations": {
            "dev": {
              "foo": "bar",
            },
            "prod": {
              "foo": "baz",
              "optimize": true,
            },
          },
          "executor": "build",
          "options": {
            "a": 1,
            "b": {
              "c": 2,
            },
            "d": 3,
          },
        }
      `);
      expect(merged.targets['shouldntMerge']).toEqual(
        shouldntMergeConfigurationB
      );
      expect(merged.targets['newTarget']).toEqual(newTargetConfiguration);
    });

    it('should not create new targets if ONLY_MODIFIES_EXISTING_TARGET is true', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            echo: {
              command: 'echo lib-a',
            },
          },
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            command: 'tsc',
            [ONLY_MODIFIES_EXISTING_TARGET]: true,
          } as any,
          echo: {
            options: {
              cwd: '{projectRoot}',
            },
            [ONLY_MODIFIES_EXISTING_TARGET]: true,
          } as any,
        },
      });
      const { targets } = rootMap.get('libs/lib-a');
      expect(targets.build).toBeUndefined();
      // cwd was merged in, and ONLY_MODIFIES_EXISTING_TARGET was removed
      expect(targets.echo).toMatchInlineSnapshot(`
        {
          "command": "echo lib-a",
          "options": {
            "cwd": "{projectRoot}",
          },
        }
      `);
    });

    it('should concatenate tags and implicitDependencies', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          tags: ['a', 'b'],
          implicitDependencies: ['lib-b'],
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        tags: ['b', 'c'],
        implicitDependencies: ['lib-c', '!lib-b'],
      });
      expect(rootMap.get('libs/lib-a').tags).toEqual(['a', 'b', 'c']);
      expect(rootMap.get('libs/lib-a').implicitDependencies).toEqual([
        'lib-b',
        'lib-c',
        '!lib-b',
      ]);
    });

    it('should merge generator options', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          generators: {
            '@nx/angular:component': {
              style: 'scss',
            },
          },
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        generators: {
          '@nx/angular:component': {
            flat: true,
          },
          '@nx/angular:service': {
            spec: false,
          },
        },
      });
      expect(rootMap.get('libs/lib-a').generators).toMatchInlineSnapshot(`
        {
          "@nx/angular:component": {
            "flat": true,
            "style": "scss",
          },
          "@nx/angular:service": {
            "spec": false,
          },
        }
      `);
    });

    it('should merge namedInputs', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          namedInputs: {
            production: [
              '{projectRoot}/**/*.ts',
              '!{projectRoot}/**/*.spec.ts',
            ],
            test: ['{projectRoot}/**/*.spec.ts'],
          },
        })
        .getRootMap();
      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        namedInputs: {
          another: ['{projectRoot}/**/*.ts'],
          production: ['{projectRoot}/**/*.prod.ts'],
        },
      });
      expect(rootMap.get('libs/lib-a').namedInputs).toMatchInlineSnapshot(`
        {
          "another": [
            "{projectRoot}/**/*.ts",
          ],
          "production": [
            "{projectRoot}/**/*.prod.ts",
          ],
          "test": [
            "{projectRoot}/**/*.spec.ts",
          ],
        }
      `);
    });

    describe('source map', () => {
      it('should add new project info', () => {
        const rootMap = new RootMapBuilder().getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo hello',
                },
                configurations: {
                  dev: {
                    command: 'echo dev',
                  },
                  production: {
                    command: 'echo production',
                  },
                },
              },
            },
            tags: ['a', 'b'],
            implicitDependencies: ['lib-b'],
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        expect(sourceMap).toMatchInlineSnapshot(`
          {
            "libs/lib-a": {
              "implicitDependencies": [
                "dummy",
                "dummy.ts",
              ],
              "implicitDependencies.lib-b": [
                "dummy",
                "dummy.ts",
              ],
              "name": [
                "dummy",
                "dummy.ts",
              ],
              "root": [
                "dummy",
                "dummy.ts",
              ],
              "tags": [
                "dummy",
                "dummy.ts",
              ],
              "tags.a": [
                "dummy",
                "dummy.ts",
              ],
              "tags.b": [
                "dummy",
                "dummy.ts",
              ],
              "targets": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.configurations": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.configurations.dev": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.configurations.dev.command": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.configurations.production": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.configurations.production.command": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.executor": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.options": [
                "dummy",
                "dummy.ts",
              ],
              "targets.build.options.command": [
                "dummy",
                "dummy.ts",
              ],
            },
          }
        `);
      });

      it('should merge root level properties', () => {
        const rootMap = new Map();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            tags: ['a', 'b'],
            projectType: 'application',
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            projectType: 'library',
            tags: ['c'],
            implicitDependencies: ['lib-b'],
          },
          sourceMap,
          ['dummy2', 'dummy2.ts']
        );
        assertCorrectKeysInSourceMap(
          sourceMap,
          'libs/lib-a',
          ['tags.a', 'dummy'],
          ['tags.c', 'dummy2'],
          ['projectType', 'dummy2'],
          ['implicitDependencies.lib-b', 'dummy2']
        );
      });

      it('should merge target properties for compatible targets', () => {
        const rootMap = new RootMapBuilder().getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: ['input1'],
                options: {
                  command: 'echo hello',
                  oldOption: 'value',
                },
                configurations: {
                  dev: {
                    command: 'echo dev',
                    oldOption: 'old option',
                  },
                },
              },
            },
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                inputs: ['input2'],
                outputs: ['output2'],
                options: {
                  oldOption: 'new value',
                  newOption: 'value',
                },
                configurations: {
                  dev: {
                    command: 'echo dev 2',
                    newOption: 'new option',
                  },
                  production: {
                    command: 'echo production',
                  },
                },
              },
            },
          },
          sourceMap,
          ['dummy2', 'dummy2.ts']
        );

        assertCorrectKeysInSourceMap(
          sourceMap,
          'libs/lib-a',
          ['targets.build', 'dummy2'],
          ['targets.build.executor', 'dummy'],
          ['targets.build.inputs', 'dummy2'],
          ['targets.build.outputs', 'dummy2'],
          ['targets.build.options', 'dummy2'],
          ['targets.build.options.command', 'dummy'],
          ['targets.build.options.oldOption', 'dummy2'],
          ['targets.build.options.newOption', 'dummy2'],
          ['targets.build.configurations', 'dummy2'],
          ['targets.build.configurations.dev.command', 'dummy2'],
          ['targets.build.configurations.dev.oldOption', 'dummy'],
          ['targets.build.configurations.dev.newOption', 'dummy2'],
          ['targets.build.configurations.production.command', 'dummy2']
        );
      });

      it('should override target options & configurations for incompatible targets', () => {
        const rootMap = new RootMapBuilder().getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo hello',
                  oldOption: 'value',
                },
                configurations: {
                  dev: {
                    command: 'echo dev',
                    oldOption: 'old option',
                  },
                },
              },
            },
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'other-executor',
                options: {
                  option1: 'option1',
                },
                configurations: {
                  prod: {
                    command: 'echo dev',
                  },
                },
              },
            },
          },
          sourceMap,
          ['dummy2', 'dummy2.ts']
        );
        assertCorrectKeysInSourceMap(
          sourceMap,
          'libs/lib-a',
          ['targets.build', 'dummy2'],
          ['targets.build.executor', 'dummy2'],
          ['targets.build.options', 'dummy2'],
          ['targets.build.options.option1', 'dummy2'],
          ['targets.build.configurations', 'dummy2'],
          ['targets.build.configurations.prod', 'dummy2'],
          ['targets.build.configurations.prod.command', 'dummy2']
        );

        expect(
          sourceMap['libs/lib-a']['targets.build.configurations.dev']
        ).toBeFalsy();
        expect(sourceMap['libs/lib-a']['targets.build.outputs']).toBeFalsy();
        expect(
          sourceMap['libs/lib-a']['targets.build.options.command']
        ).toBeFalsy();
      });

      it('should not merge top level properties for incompatible targets', () => {
        const rootMap = new RootMapBuilder().getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: ['input1'],
              },
            },
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            root: 'libs/lib-a',
            name: 'lib-a',
            targets: {
              build: {
                executor: 'other-executor',
                outputs: ['output1'],
              },
            },
          },
          sourceMap,
          ['dummy2', 'dummy2.ts']
        );
        assertCorrectKeysInSourceMap(
          sourceMap,
          'libs/lib-a',
          ['targets.build', 'dummy2'],
          ['targets.build.executor', 'dummy2'],
          ['targets.build.outputs', 'dummy2']
        );

        expect(sourceMap['libs/lib-a']['targets.build.inputs']).toBeFalsy();
      });

      it('should merge generator property', () => {
        const rootMap = new RootMapBuilder().getRootMap();
        const sourceMap: ConfigurationSourceMaps = {
          'libs/lib-a': {},
        };
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            name: 'lib-a',
            root: 'libs/lib-a',
            generators: {
              '@nx/angular:component': {
                option1: true,
                option2: 'true',
              },
            },
          },
          sourceMap,
          ['dummy', 'dummy.ts']
        );
        mergeProjectConfigurationIntoRootMap(
          rootMap,
          {
            name: 'lib-a',
            root: 'libs/lib-a',
            generators: {
              '@nx/angular:component': {
                option1: false,
                option3: {
                  nested: 3,
                },
              },
            },
          },
          sourceMap,
          ['dummy2', 'dummy2.ts']
        );

        assertCorrectKeysInSourceMap(
          sourceMap,
          'libs/lib-a',
          ['generators.@nx/angular:component.option1', 'dummy2'],
          ['generators.@nx/angular:component.option2', 'dummy'],
          ['generators.@nx/angular:component.option3', 'dummy2']
        );
      });
    });
  });

  describe('readProjectsConfigurationsFromRootMap', () => {
    it('should error if multiple roots point to the same project', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          name: 'lib',
          root: 'apps/lib-a',
        })
        .addProject({
          name: 'lib',
          root: 'apps/lib-b',
        })
        .getRootMap();

      expect(() => {
        readProjectConfigurationsFromRootMap(rootMap);
      }).toThrowErrorMatchingInlineSnapshot(`
        "The following projects are defined in multiple locations:
        - lib: 
          - apps/lib-a
          - apps/lib-b

        To fix this, set a unique name for each project in a project.json inside the project's root. If the project does not currently have a project.json, you can create one that contains only a name."
      `);
    });

    it('should read root map into standard projects configurations form', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          name: 'lib-a',
          root: 'libs/a',
        })
        .addProject({
          name: 'lib-b',
          root: 'libs/b',
        })
        .addProject({
          name: 'lib-shared-b',
          root: 'libs/shared/b',
        })
        .getRootMap();
      expect(readProjectConfigurationsFromRootMap(rootMap))
        .toMatchInlineSnapshot(`
        {
          "lib-a": {
            "name": "lib-a",
            "root": "libs/a",
          },
          "lib-b": {
            "name": "lib-b",
            "root": "libs/b",
          },
          "lib-shared-b": {
            "name": "lib-shared-b",
            "root": "libs/shared/b",
          },
        }
      `);
    });
  });

  describe('isCompatibleTarget', () => {
    it('should return true if only one target specifies an executor', () => {
      expect(
        isCompatibleTarget(
          {
            executor: 'nx:run-commands',
          },
          {}
        )
      ).toBe(true);
    });

    it('should return true if both targets specify the same executor', () => {
      expect(
        isCompatibleTarget(
          {
            executor: 'nx:run-commands',
          },
          {
            executor: 'nx:run-commands',
          }
        )
      ).toBe(true);
    });

    it('should return false if both targets specify different executors', () => {
      expect(
        isCompatibleTarget(
          {
            executor: 'nx:run-commands',
          },
          {
            executor: 'other-executor',
          }
        )
      ).toBe(false);
    });

    it('should return true if both targets specify the same command', () => {
      expect(
        isCompatibleTarget(
          {
            executor: 'nx:run-commands',
            options: {
              command: 'echo',
            },
          },
          {
            executor: 'nx:run-commands',
            options: {
              command: 'echo',
            },
          }
        )
      ).toBe(true);
    });

    it('should return false if both targets specify different commands', () => {
      expect(
        isCompatibleTarget(
          {
            executor: 'nx:run-commands',
            options: {
              command: 'echo',
            },
          },
          {
            executor: 'nx:run-commands',
            options: {
              command: 'echo2',
            },
          }
        )
      ).toBe(false);
    });
  });
});

class RootMapBuilder {
  private rootMap: Map<string, ProjectConfiguration> = new Map();

  addProject(p: ProjectConfiguration) {
    this.rootMap.set(p.root, p);
    return this;
  }

  getRootMap() {
    return this.rootMap;
  }
}

function assertCorrectKeysInSourceMap(
  sourceMaps: ConfigurationSourceMaps,
  root: string,
  ...tuples: [string, string][]
) {
  const sourceMap = sourceMaps[root];
  tuples.forEach(([key, value]) => {
    if (!sourceMap[key]) {
      throw new Error(`Expected sourceMap to contain key ${key}`);
    }
    try {
      expect(sourceMap[key][0]).toEqual(value);
    } catch (error) {
      // Enhancing the error message with the problematic key
      throw new Error(`Assertion failed for key '${key}': \n ${error.message}`);
    }
  });
}
