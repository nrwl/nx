import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import {
  mergeProjectConfigurationIntoRootMap,
  mergeTargetConfigurations,
  readProjectConfigurationsFromRootMap,
  readTargetDefaultsForTarget,
} from './project-configuration-utils';

describe('project-configuration-utils', () => {
  describe('target defaults', () => {
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
              "command": "tsc",
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

    it('should concatenate tags', () => {
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
