import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import {
  mergeProjectConfigurationIntoRootMap,
  readProjectConfigurationsFromRootMap,
} from './project-nodes-manager';
import type { ConfigurationSourceMaps } from './source-maps';

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
    expect(rootMap['libs/lib-a']).toMatchInlineSnapshot(`
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
    const merged = rootMap['libs/lib-a'];
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

  it('should merge target configurations with glob pattern matching', () => {
    const existingTargetConfiguration = {
      command: 'already present',
    };
    const partialA = {
      executor: 'build',
      dependsOn: ['^build'],
    };
    const partialB = {
      executor: 'build',
      dependsOn: ['^build'],
    };
    const partialC = {
      executor: 'build',
      dependsOn: ['^build'],
    };
    const globMatch = {
      dependsOn: ['^build', { project: 'app', target: 'build' }],
    };
    const nonMatchingGlob = {
      dependsOn: ['^production', 'build'],
    };

    const rootMap = new RootMapBuilder()
      .addProject({
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          existingTarget: existingTargetConfiguration,
          'partial-path/a': partialA,
          'partial-path/b': partialB,
          'partial-path/c': partialC,
        },
      })
      .getRootMap();
    mergeProjectConfigurationIntoRootMap(rootMap, {
      root: 'libs/lib-a',
      name: 'lib-a',
      targets: {
        'partial-**/*': globMatch,
        'ci-*': nonMatchingGlob,
      },
    });
    const merged = rootMap['libs/lib-a'];
    expect(merged.targets['partial-path/a']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
          {
            "project": "app",
            "target": "build",
          },
        ],
        "executor": "build",
      }
    `);
    expect(merged.targets['partial-path/b']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
          {
            "project": "app",
            "target": "build",
          },
        ],
        "executor": "build",
      }
    `);
    expect(merged.targets['partial-path/c']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^build",
          {
            "project": "app",
            "target": "build",
          },
        ],
        "executor": "build",
      }
    `);
    // if the glob pattern doesn't match, the target is not merged
    expect(merged.targets['ci-*']).toMatchInlineSnapshot(`
      {
        "dependsOn": [
          "^production",
          "build",
        ],
      }
    `);
    // if the glob pattern matches, the target is merged
    expect(merged.targets['partial-**/*']).toBeUndefined();
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
    expect(rootMap['libs/lib-a'].tags).toEqual(['a', 'b', 'c']);
    expect(rootMap['libs/lib-a'].implicitDependencies).toEqual([
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
    expect(rootMap['libs/lib-a'].generators).toMatchInlineSnapshot(`
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
          production: ['{projectRoot}/**/*.ts', '!{projectRoot}/**/*.spec.ts'],
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
    expect(rootMap['libs/lib-a'].namedInputs).toMatchInlineSnapshot(`
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

  it('should merge release', () => {
    const rootMap = new RootMapBuilder()
      .addProject({
        root: 'libs/lib-a',
        name: 'lib-a',
      })
      .getRootMap();
    mergeProjectConfigurationIntoRootMap(rootMap, {
      root: 'libs/lib-a',
      name: 'lib-a',
      release: {
        version: {
          versionActionsOptions: { fo: 'bar' },
        },
      },
    });
    expect(rootMap['libs/lib-a'].release).toMatchInlineSnapshot(`
      {
        "version": {
          "versionActionsOptions": {
            "fo": "bar",
          },
        },
      }
    `);
  });

  describe('metadata', () => {
    it('should be set if not previously defined', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {},
      };
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            technologies: ['technology'],
            targetGroups: {
              group1: ['target1', 'target2'],
            },
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].metadata).toEqual({
        technologies: ['technology'],
        targetGroups: {
          group1: ['target1', 'target2'],
        },
      });
      expect(sourceMap['libs/lib-a']).toMatchObject({
        'metadata.technologies': ['dummy', 'dummy.ts'],
        'metadata.targetGroups': ['dummy', 'dummy.ts'],
        'metadata.targetGroups.group1': ['dummy', 'dummy.ts'],
      });
    });

    it('should concat arrays', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            technologies: ['technology1'],
          },
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {
          'metadata.technologies': ['existing', 'existing.ts'],
          'metadata.technologies.0': ['existing', 'existing.ts'],
        },
      };
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            technologies: ['technology2'],
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].metadata).toEqual({
        technologies: ['technology1', 'technology2'],
      });
      expect(sourceMap['libs/lib-a']).toMatchObject({
        'metadata.technologies': ['existing', 'existing.ts'],
        'metadata.technologies.0': ['existing', 'existing.ts'],
        'metadata.technologies.1': ['dummy', 'dummy.ts'],
      });
    });

    it('should concat second level arrays', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            targetGroups: {
              group1: ['target1'],
            },
          },
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {
          'metadata.targetGroups': ['existing', 'existing.ts'],
          'metadata.targetGroups.group1': ['existing', 'existing.ts'],
          'metadata.targetGroups.group1.0': ['existing', 'existing.ts'],
        },
      };
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            targetGroups: {
              group1: ['target2'],
            },
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].metadata).toEqual({
        targetGroups: {
          group1: ['target1', 'target2'],
        },
      });

      expect(sourceMap['libs/lib-a']).toMatchObject({
        'metadata.targetGroups': ['existing', 'existing.ts'],
        'metadata.targetGroups.group1': ['existing', 'existing.ts'],
        'metadata.targetGroups.group1.0': ['existing', 'existing.ts'],
        'metadata.targetGroups.group1.1': ['dummy', 'dummy.ts'],
      });

      expect(sourceMap['libs/lib-a']['metadata.targetGroups']).toEqual([
        'existing',
        'existing.ts',
      ]);
      expect(sourceMap['libs/lib-a']['metadata.targetGroups.group1']).toEqual([
        'existing',
        'existing.ts',
      ]);
      expect(sourceMap['libs/lib-a']['metadata.targetGroups.group1.0']).toEqual(
        ['existing', 'existing.ts']
      );
      expect(sourceMap['libs/lib-a']['metadata.targetGroups.group1.1']).toEqual(
        ['dummy', 'dummy.ts']
      );
    });

    it('should not clobber targetGroups', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            targetGroups: {
              group2: ['target3'],
            },
          },
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {},
      };

      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          metadata: {
            technologies: ['technology'],
            targetGroups: {
              group1: ['target1', 'target2'],
            },
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].metadata).toEqual({
        technologies: ['technology'],
        targetGroups: {
          group1: ['target1', 'target2'],
          group2: ['target3'],
        },
      });
    });

    it('should be added to targets', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
        })
        .getRootMap();
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
              metadata: {
                description: 'do stuff',
                technologies: ['tech'],
              },
            },
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].targets.build.metadata).toEqual({
        description: 'do stuff',
        technologies: ['tech'],
      });
      expect(sourceMap['libs/lib-a']).toMatchObject({
        'targets.build.metadata.description': ['dummy', 'dummy.ts'],
        'targets.build.metadata.technologies': ['dummy', 'dummy.ts'],
        'targets.build.metadata.technologies.0': ['dummy', 'dummy.ts'],
      });
    });

    it('should be merged on targets', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              metadata: {
                description: 'do stuff',
                technologies: ['tech'],
              },
            },
          },
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {
          'targets.build.metadata.technologies': ['existing', 'existing.ts'],
          'targets.build.metadata.technologies.0': ['existing', 'existing.ts'],
        },
      };
      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              metadata: {
                description: 'do cool stuff',
                technologies: ['tech2'],
              },
            },
          },
        },
        sourceMap,
        ['dummy', 'dummy.ts']
      );

      expect(rootMap['libs/lib-a'].targets.build.metadata).toEqual({
        description: 'do cool stuff',
        technologies: ['tech', 'tech2'],
      });
      expect(sourceMap['libs/lib-a']).toMatchObject({
        'targets.build.metadata.description': ['dummy', 'dummy.ts'],
        'targets.build.metadata.technologies': ['existing', 'existing.ts'],
        'targets.build.metadata.technologies.0': ['existing', 'existing.ts'],
        'targets.build.metadata.technologies.1': ['dummy', 'dummy.ts'],
      });
    });
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
      const rootMap: Record<string, ProjectConfiguration> = {};
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

class RootMapBuilder {
  private rootMap: Record<string, ProjectConfiguration> = {};

  addProject(p: ProjectConfiguration) {
    this.rootMap[p.root] = p;
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
