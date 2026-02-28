import {
  ProjectConfiguration,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import {
  ConfigurationSourceMaps,
  SourceInformation,
  createProjectConfigurationsWithPlugins,
  isCompatibleTarget,
  mergeProjectConfigurationIntoRootMap,
  mergeTargetConfigurations,
  mergeTargetDefaultWithTargetDefinition,
  normalizeTarget,
  readProjectConfigurationsFromRootMap,
  readTargetDefaultsForTarget,
} from './project-configuration-utils';
import { createNodesFromFiles, NxPluginV2 } from '../plugins';
import { LoadedNxPlugin } from '../plugins/loaded-nx-plugin';
import { dirname } from 'path';
import { isProjectConfigurationsError } from '../error-types';
import { workspaceRoot } from '../../utils/workspace-root';

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
      'e2e-ci--*': {
        options: {
          key: 'default-value-for-e2e-ci',
        },
      },
      'e2e-ci--file-*': {
        options: {
          key: 'default-value-for-e2e-ci-file',
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

    it('should return longest matching target', () => {
      expect(
        // This matches both 'e2e-ci--*' and 'e2e-ci--file-*', we expect the first match to be returned.
        readTargetDefaultsForTarget(
          'e2e-ci--file-foo',
          targetDefaults,
          undefined
        ).options['key']
      ).toEqual('default-value-for-e2e-ci-file');
    });

    it('should return longest matching target even if executor is passed', () => {
      expect(
        // This uses an executor which does not have settings in target defaults
        // thus the target name pattern target defaults are used
        readTargetDefaultsForTarget(
          'e2e-ci--file-foo',
          targetDefaults,
          'other-executor'
        ).options['key']
      ).toEqual('default-value-for-e2e-ci-file');
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

    describe('spread syntax in merging', () => {
      describe('array spread with "..."', () => {
        it('should spread base array at the position of "..."', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input-1', '...', 'new-input-2'],
            },
            {
              executor: 'target',
              inputs: ['base-input-1', 'base-input-2'],
            }
          );
          expect(result.inputs).toEqual([
            'new-input-1',
            'base-input-1',
            'base-input-2',
            'new-input-2',
          ]);
        });

        it('should spread base array at the beginning when "..." is first', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              outputs: ['...', 'new-output'],
            },
            {
              executor: 'target',
              outputs: ['base-output-1', 'base-output-2'],
            }
          );
          expect(result.outputs).toEqual([
            'base-output-1',
            'base-output-2',
            'new-output',
          ]);
        });

        it('should spread base array at the end when "..." is last', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input', '...'],
            },
            {
              executor: 'target',
              inputs: ['base-input-1', 'base-input-2'],
            }
          );
          expect(result.inputs).toEqual([
            'new-input',
            'base-input-1',
            'base-input-2',
          ]);
        });

        it('should handle "..." when base array is empty', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input-1', '...', 'new-input-2'],
            },
            {
              executor: 'target',
              inputs: [],
            }
          );
          expect(result.inputs).toEqual(['new-input-1', 'new-input-2']);
        });

        it('should handle "..." when base array is undefined', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input-1', '...', 'new-input-2'],
            },
            {
              executor: 'target',
            }
          );
          expect(result.inputs).toEqual(['new-input-1', 'new-input-2']);
        });

        it('should spread in dependsOn array', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              dependsOn: ['new-dep', '...'],
            },
            {
              executor: 'target',
              dependsOn: ['^build', 'test'],
            }
          );
          expect(result.dependsOn).toEqual(['new-dep', '^build', 'test']);
        });

        it('should spread array option values within options', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                assets: ['new-asset', '...'],
              },
            },
            {
              executor: 'target',
              options: {
                assets: ['base-asset-1', 'base-asset-2'],
              },
            }
          );
          expect(result.options).toEqual({
            assets: ['new-asset', 'base-asset-1', 'base-asset-2'],
          });
        });
      });

      describe('object spread with "..." in nested options', () => {
        it('should spread base object properties in nested option objects', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                env: {
                  NEW_VAR: 'new',
                  '...': true,
                },
              },
            },
            {
              executor: 'target',
              options: {
                env: {
                  BASE_VAR: 'base',
                  EXISTING: 'existing',
                },
              },
            }
          );
          expect(result.options?.env).toEqual({
            NEW_VAR: 'new',
            BASE_VAR: 'base',
            EXISTING: 'existing',
          });
        });

        it('should allow new values to override spread base values when defined after "..."', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                config: {
                  '...': true,
                  sharedKey: 'new-value',
                },
              },
            },
            {
              executor: 'target',
              options: {
                config: {
                  sharedKey: 'base-value',
                  baseOnly: 'base',
                },
              },
            }
          );
          expect(result.options?.config).toEqual({
            sharedKey: 'new-value',
            baseOnly: 'base',
          });
        });

        it('should preserve base values when "..." comes after in object iteration', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                config: {
                  sharedKey: 'new-value',
                  '...': true,
                },
              },
            },
            {
              executor: 'target',
              options: {
                config: {
                  sharedKey: 'base-value',
                  baseOnly: 'base',
                },
              },
            }
          );
          // The order of spread determines which value wins
          // When "..." comes after sharedKey, the base value overwrites
          expect(result.options?.config).toEqual({
            sharedKey: 'base-value',
            baseOnly: 'base',
          });
        });
        it('should keep "..." with a comment string value as a regular property', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                env: {
                  NEW_VAR: 'new',
                  '...': 'This is a comment',
                },
              },
            },
            {
              executor: 'target',
              options: {
                env: {
                  BASE_VAR: 'base',
                },
              },
            }
          );
          // String value for '...' should NOT trigger spread - only `true` triggers it
          expect(result.options?.env).toEqual({
            NEW_VAR: 'new',
            '...': 'This is a comment',
          });
        });
      });

      describe('spread in configurations', () => {
        it('should spread arrays in configuration options', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'new.ts', with: 'new.prod.ts' },
                    '...',
                  ],
                },
              },
            },
            {
              executor: 'target',
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'base.ts', with: 'base.prod.ts' },
                  ],
                },
              },
            }
          );
          expect(result.configurations?.prod.fileReplacements).toEqual([
            { replace: 'new.ts', with: 'new.prod.ts' },
            { replace: 'base.ts', with: 'base.prod.ts' },
          ]);
        });

        it('should spread objects in configuration options', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: {
                prod: {
                  env: {
                    NEW_VAR: 'new',
                    '...': true,
                  },
                },
              },
            },
            {
              executor: 'target',
              configurations: {
                prod: {
                  env: {
                    BASE_VAR: 'base',
                  },
                },
              },
            }
          );
          expect(result.configurations?.prod.env).toEqual({
            NEW_VAR: 'new',
            BASE_VAR: 'base',
          });
        });

        it('should spread arrays in multiple configurations', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: {
                dev: {
                  scripts: ['dev-script', '...'],
                },
                prod: {
                  scripts: ['...', 'prod-script'],
                },
              },
            },
            {
              executor: 'target',
              configurations: {
                dev: {
                  scripts: ['base-dev-1', 'base-dev-2'],
                },
                prod: {
                  scripts: ['base-prod'],
                },
              },
            }
          );
          expect(result.configurations?.dev.scripts).toEqual([
            'dev-script',
            'base-dev-1',
            'base-dev-2',
          ]);
          expect(result.configurations?.prod.scripts).toEqual([
            'base-prod',
            'prod-script',
          ]);
        });
      });

      describe('"..." in base target should not affect result', () => {
        it('should ignore "..." in base array when target overrides without spread', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['override-1', 'override-2'],
            },
            {
              executor: 'target',
              inputs: ['base-1', '...', 'base-2'],
            }
          );
          expect(result.inputs).toEqual(['override-1', 'override-2']);
        });

        it('should ignore "..." in base object option when target overrides without spread', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                env: {
                  NEW_VAR: 'new',
                },
              },
            },
            {
              executor: 'target',
              options: {
                env: {
                  '...': true,
                  BASE_VAR: 'base',
                },
              },
            }
          );
          expect(result.options?.env).toEqual({
            NEW_VAR: 'new',
          });
        });

        it('should ignore "..." in base configuration array when target overrides without spread', () => {
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'new.ts', with: 'new.prod.ts' },
                  ],
                },
              },
            },
            {
              executor: 'target',
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'base.ts', with: 'base.prod.ts' },
                    '...',
                  ],
                },
              },
            }
          );
          expect(result.configurations?.prod.fileReplacements).toEqual([
            { replace: 'new.ts', with: 'new.prod.ts' },
          ]);
        });
      });

      describe('source map tracking with spread', () => {
        it('should track per-element source for array spread in top-level properties', () => {
          const sourceMap: Record<string, SourceInformation> = {};
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input', '...'],
            },
            {
              executor: 'target',
              inputs: ['base-input-1', 'base-input-2'],
            },
            sourceMap,
            ['new-file', 'new-plugin'],
            'targets.build'
          );
          expect(result.inputs).toEqual([
            'new-input',
            'base-input-1',
            'base-input-2',
          ]);
          // new-input came from the overriding target
          expect(sourceMap['targets.build.inputs.0']).toEqual([
            'new-file',
            'new-plugin',
          ]);
          // base elements retain the base source (looked up from parent key)
          // Since there was no prior source map entry, base elements won't have entries
          // The parent key should be attributed to the new source
          expect(sourceMap['targets.build.inputs']).toEqual([
            'new-file',
            'new-plugin',
          ]);
        });

        it('should track per-element source for array spread with existing source map', () => {
          const sourceMap: Record<string, SourceInformation> = {
            'targets.build.inputs': ['base-file', 'base-plugin'],
          };
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              inputs: ['new-input', '...', 'new-input-2'],
            },
            {
              executor: 'target',
              inputs: ['base-input-1', 'base-input-2'],
            },
            sourceMap,
            ['new-file', 'new-plugin'],
            'targets.build'
          );
          expect(result.inputs).toEqual([
            'new-input',
            'base-input-1',
            'base-input-2',
            'new-input-2',
          ]);
          expect(sourceMap['targets.build.inputs']).toEqual([
            'new-file',
            'new-plugin',
          ]);
          expect(sourceMap['targets.build.inputs.0']).toEqual([
            'new-file',
            'new-plugin',
          ]);
          expect(sourceMap['targets.build.inputs.1']).toEqual([
            'base-file',
            'base-plugin',
          ]);
          expect(sourceMap['targets.build.inputs.2']).toEqual([
            'base-file',
            'base-plugin',
          ]);
          expect(sourceMap['targets.build.inputs.3']).toEqual([
            'new-file',
            'new-plugin',
          ]);
        });

        it('should track per-property source for object spread in options', () => {
          const sourceMap: Record<string, SourceInformation> = {
            'targets.build.options.env': ['base-file', 'base-plugin'],
          };
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                env: {
                  NEW_VAR: 'new',
                  '...': true,
                  OVERRIDE: 'new-value',
                },
              },
            },
            {
              executor: 'target',
              options: {
                env: {
                  BASE_VAR: 'base',
                  OVERRIDE: 'base-value',
                },
              },
            },
            sourceMap,
            ['new-file', 'new-plugin'],
            'targets.build'
          );
          expect(result.options.env).toEqual({
            NEW_VAR: 'new',
            BASE_VAR: 'base',
            OVERRIDE: 'new-value',
          });
          expect(sourceMap['targets.build.options.env']).toEqual([
            'new-file',
            'new-plugin',
          ]);
          expect(sourceMap['targets.build.options.env.NEW_VAR']).toEqual([
            'new-file',
            'new-plugin',
          ]);
          expect(sourceMap['targets.build.options.env.BASE_VAR']).toEqual([
            'base-file',
            'base-plugin',
          ]);
          // OVERRIDE appears before '...' AND after '...' — new value wins because
          // it's defined after the spread token in the new object
          expect(sourceMap['targets.build.options.env.OVERRIDE']).toEqual([
            'new-file',
            'new-plugin',
          ]);
        });

        it('should track base source for object properties overwritten by spread', () => {
          const sourceMap: Record<string, SourceInformation> = {
            'targets.build.options.config': ['base-file', 'base-plugin'],
          };
          const result = mergeTargetConfigurations(
            {
              executor: 'target',
              options: {
                config: {
                  sharedKey: 'new-value',
                  '...': true,
                },
              },
            },
            {
              executor: 'target',
              options: {
                config: {
                  sharedKey: 'base-value',
                  baseOnly: 'base',
                },
              },
            },
            sourceMap,
            ['new-file', 'new-plugin'],
            'targets.build'
          );
          // sharedKey defined before '...', base spread overwrites it
          expect(result.options.config).toEqual({
            sharedKey: 'base-value',
            baseOnly: 'base',
          });
          // Both properties came from base (spread overwrote the new value)
          expect(sourceMap['targets.build.options.config.sharedKey']).toEqual([
            'base-file',
            'base-plugin',
          ]);
          expect(sourceMap['targets.build.options.config.baseOnly']).toEqual([
            'base-file',
            'base-plugin',
          ]);
        });
      });
    });

    describe('metadata', () => {
      it('should be added', () => {
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

        expect(rootMap['libs/lib-a'].targets!.build.metadata).toEqual({
          description: 'do stuff',
          technologies: ['tech'],
        });
        expect(sourceMap['libs/lib-a']).toMatchObject({
          'targets.build.metadata.description': ['dummy', 'dummy.ts'],
          'targets.build.metadata.technologies': ['dummy', 'dummy.ts'],
          'targets.build.metadata.technologies.0': ['dummy', 'dummy.ts'],
        });
      });

      it('should be merged', () => {
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
            'targets.build.metadata.technologies.0': [
              'existing',
              'existing.ts',
            ],
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

        expect(rootMap['libs/lib-a'].targets!.build.metadata).toEqual({
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
      expect(merged.targets!['existingTarget']).toEqual(
        existingTargetConfiguration
      );
      expect(merged.targets!['shouldMerge']).toMatchInlineSnapshot(`
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
      expect(merged.targets!['shouldntMerge']).toEqual(
        shouldntMergeConfigurationB
      );
      expect(merged.targets!['newTarget']).toEqual(newTargetConfiguration);
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
      expect(merged.targets!['partial-path/a']).toMatchInlineSnapshot(`
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
      expect(merged.targets!['partial-path/b']).toMatchInlineSnapshot(`
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
      expect(merged.targets!['partial-path/c']).toMatchInlineSnapshot(`
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
      expect(merged.targets!['ci-*']).toMatchInlineSnapshot(`
        {
          "dependsOn": [
            "^production",
            "build",
          ],
        }
      `);
      // if the glob pattern matches, the target is merged
      expect(merged.targets!['partial-**/*']).toBeUndefined();
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
        expect(sourceMap['libs/lib-a']['metadata.targetGroups.group1']).toEqual(
          ['existing', 'existing.ts']
        );
        expect(
          sourceMap['libs/lib-a']['metadata.targetGroups.group1.0']
        ).toEqual(['existing', 'existing.ts']);
        expect(
          sourceMap['libs/lib-a']['metadata.targetGroups.group1.1']
        ).toEqual(['dummy', 'dummy.ts']);
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

    it('should return false if one target specifies a command, and the other specifies commands', () => {
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
              commands: ['echo', 'other'],
            },
          }
        )
      ).toBe(false);
    });
  });

  describe('normalizeTarget', () => {
    it('should support {projectRoot}, {workspaceRoot}, and {projectName} tokens', () => {
      const config = {
        name: 'project',
        root: 'libs/project',
        targets: {
          foo: { command: 'echo {projectRoot}' },
        },
      };
      expect(normalizeTarget(config.targets.foo, config, workspaceRoot, {}, ''))
        .toMatchInlineSnapshot(`
        {
          "configurations": {},
          "executor": "nx:run-commands",
          "options": {
            "command": "echo libs/project",
          },
          "parallelism": true,
        }
      `);
    });
    it('should not mutate the target', () => {
      const config = {
        name: 'project',
        root: 'libs/project',
        targets: {
          foo: {
            executor: 'nx:noop',
            options: {
              config: '{projectRoot}/config.json',
            },
            configurations: {
              prod: {
                config: '{projectRoot}/config.json',
              },
            },
          },
          bar: {
            command: 'echo {projectRoot}',
            options: {
              config: '{projectRoot}/config.json',
            },
            configurations: {
              prod: {
                config: '{projectRoot}/config.json',
              },
            },
          },
        },
      };
      const originalConfig = JSON.stringify(config, null, 2);

      normalizeTarget(config.targets.foo, config, workspaceRoot, {}, '');
      normalizeTarget(config.targets.bar, config, workspaceRoot, {}, '');
      expect(JSON.stringify(config, null, 2)).toEqual(originalConfig);
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
            {} as any,
            {} as any
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
            {} as any,
            {} as any
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
            {} as any,
            {} as any
          ),
      ],
    };

    it('should create nodes for files matching included patterns only', async () => {
      const projectConfigurations =
        await createProjectConfigurationsWithPlugins(
          undefined,
          {},
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
              }),
            ],
          }
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
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                include: ['libs/a/**'],
              }),
            ],
          }
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
          {
            specifiedPluginFiles: [],
            defaultPluginFiles: [
              ['libs/a/project.json', 'libs/b/project.json'],
            ],
          },
          {
            specifiedPlugins: [],
            defaultPlugins: [
              new LoadedNxPlugin(fakeTagPlugin, {
                plugin: fakeTagPlugin.name,
                exclude: ['libs/b/**'],
              }),
            ],
          }
        );

      expect(projectConfigurations.projects).toEqual({
        'libs/a': {
          name: 'a',
          root: 'libs/a',
          tags: ['fake-lib'],
        },
      });
    });

    describe('negation pattern support', () => {
      it('should support negation patterns in exclude to re-include specific files', async () => {
        const projectConfigurations =
          await createProjectConfigurationsWithPlugins(
            undefined,
            {},
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a-e2e/project.json',
                  'libs/b-e2e/project.json',
                  'libs/toolkit-workspace-e2e/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['**/*-e2e/**', '!**/toolkit-workspace-e2e/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/**', '!libs/b/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                  'libs/d/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['libs/**', '!libs/b/**', '!libs/c/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['!libs/a/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['!libs/b/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                ['libs/a/project.json', 'libs/b/project.json'],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/a/**'],
                  exclude: ['libs/b/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/a/special/project.json',
                  'libs/b/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  exclude: ['libs/**', '!libs/a/**', 'libs/a/special/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                [
                  'libs/a/project.json',
                  'libs/b/project.json',
                  'libs/c/project.json',
                  'libs/d/project.json',
                ],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: ['libs/**', '!libs/d/**'],
                  exclude: ['libs/b/**', '!libs/c/**'],
                }),
              ],
            }
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
            {
              specifiedPluginFiles: [],
              defaultPluginFiles: [
                ['libs/a/project.json', 'libs/b/project.json'],
              ],
            },
            {
              specifiedPlugins: [],
              defaultPlugins: [
                new LoadedNxPlugin(fakeTagPlugin, {
                  plugin: fakeTagPlugin.name,
                  include: [],
                  exclude: [],
                }),
              ],
            }
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

    it('should normalize targets', async () => {
      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            ['libs/a/project.json'],
            ['libs/a/project.json'],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
            new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
          ],
        }
      );
      expect(projects['libs/a'].targets!.build).toMatchInlineSnapshot(`
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
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            [
              'libs/a/project.json',
              'libs/b/project.json',
              'libs/c/project.json',
            ],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(sameNamePlugin, 'same-name-plugin'),
          ],
        }
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
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            [
              'libs/a/project.json',
              'libs/b/project.json',
              'libs/c/project.json',
            ],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
          ],
        }
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
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-lib/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(invalidCachePlugin, 'invalid-cache-plugin'),
          ],
        }
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
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [
            ['libs/a/project.json'],
            ['libs/a/project.json'],
          ],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(fakeTargetsPlugin, 'fake-targets-plugin'),
            new LoadedNxPlugin(fakeTagPlugin, 'fake-tag-plugin'),
          ],
        }
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
              {} as any,
              {} as any
            ),
        ],
      };

      const error = await createProjectConfigurationsWithPlugins(
        undefined,
        {},
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-app/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [
            new LoadedNxPlugin(invalidTokenPlugin, 'invalid-token-plugin'),
          ],
        }
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
              {} as any,
              {} as any
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
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [['libs/my-lib/project.json']],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [new LoadedNxPlugin(simplePlugin, 'simple-plugin')],
        }
      ).catch((e) => e);

      expect(error.message).toContain(
        'The {workspaceRoot} token is only valid at the beginning of an option'
      );
      expect(error.message).toContain('nx.json[targetDefaults]:test');
    });
  });

  describe('merge target default with target definition', () => {
    it('should merge options', () => {
      const sourceMap: Record<string, SourceInformation> = {
        targets: ['dummy', 'dummy.ts'],
        'targets.build': ['dummy', 'dummy.ts'],
        'targets.build.options': ['dummy', 'dummy.ts'],
        'targets.build.options.command': ['dummy', 'dummy.ts'],
        'targets.build.options.cwd': ['project.json', 'nx/project-json'],
      };
      const result = mergeTargetDefaultWithTargetDefinition(
        'build',
        {
          name: 'myapp',
          root: 'apps/myapp',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                command: 'echo',
                cwd: '{workspaceRoot}',
              },
            },
          },
        },
        {
          options: {
            command: 'tsc',
            cwd: 'apps/myapp',
          },
        },
        sourceMap
      );

      // Command was defined by a non-core plugin so it should be
      // overwritten.
      expect(result.options.command).toEqual('tsc');
      expect(sourceMap['targets.build.options.command']).toEqual([
        'nx.json',
        'nx/target-defaults',
      ]);
      // Cwd was defined by a core plugin so it should be left unchanged.
      expect(result.options.cwd).toEqual('{workspaceRoot}');
      expect(sourceMap['targets.build.options.cwd']).toEqual([
        'project.json',
        'nx/project-json',
      ]);
      // other source map entries should be left unchanged
      expect(sourceMap['targets']).toEqual(['dummy', 'dummy.ts']);
    });

    it('should not overwrite dependsOn', () => {
      const sourceMap: Record<string, SourceInformation> = {
        targets: ['dummy', 'dummy.ts'],
        'targets.build': ['dummy', 'dummy.ts'],
        'targets.build.options': ['dummy', 'dummy.ts'],
        'targets.build.options.command': ['dummy', 'dummy.ts'],
        'targets.build.options.cwd': ['project.json', 'nx/project-json'],
        'targets.build.dependsOn': ['project.json', 'nx/project-json'],
      };
      const result = mergeTargetDefaultWithTargetDefinition(
        'build',
        {
          name: 'myapp',
          root: 'apps/myapp',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                command: 'echo',
                cwd: '{workspaceRoot}',
              },
              dependsOn: [],
            },
          },
        },
        {
          options: {
            command: 'tsc',
            cwd: 'apps/myapp',
          },
          dependsOn: ['^build'],
        },
        sourceMap
      );

      // Command was defined by a core plugin so it should
      // not be replaced by target default
      expect(result.dependsOn).toEqual([]);
    });

    describe('spread syntax', () => {
      it('should spread arrays in target default options using "..."', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.options': ['dummy', 'dummy.ts'],
          'targets.build.options.assets': ['dummy', 'dummy.ts'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  assets: ['project-asset-1', 'project-asset-2'],
                },
              },
            },
          },
          {
            options: {
              assets: ['default-asset', '...'],
            },
          },
          sourceMap
        );

        // Target defaults should override non-core plugin values, and spread should work
        expect(result.options.assets).toEqual([
          'default-asset',
          'project-asset-1',
          'project-asset-2',
        ]);
        // Source map should reflect that target defaults won for this property
        expect(sourceMap['targets.build.options.assets']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
      });

      it('should spread objects in target default options using "..."', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.options': ['dummy', 'dummy.ts'],
          'targets.build.options.env': ['dummy', 'dummy.ts'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    PROJECT_VAR: 'project-value',
                  },
                },
              },
            },
          },
          {
            options: {
              env: {
                DEFAULT_VAR: 'default-value',
                '...': true,
              },
            },
          },
          sourceMap
        );

        expect(result.options.env).toEqual({
          DEFAULT_VAR: 'default-value',
          PROJECT_VAR: 'project-value',
        });
      });

      it('should spread arrays in target default configurations using "..."', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.configurations': ['dummy', 'dummy.ts'],
          'targets.build.configurations.prod': ['dummy', 'dummy.ts'],
          'targets.build.configurations.prod.fileReplacements': [
            'dummy',
            'dummy.ts',
          ],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                configurations: {
                  prod: {
                    fileReplacements: [
                      { replace: 'env.ts', with: 'env.prod.ts' },
                    ],
                  },
                },
              },
            },
          },
          {
            configurations: {
              prod: {
                fileReplacements: [
                  { replace: 'default.ts', with: 'default.prod.ts' },
                  '...',
                ],
              },
            },
          },
          sourceMap
        );

        expect(result.configurations?.prod.fileReplacements).toEqual([
          { replace: 'default.ts', with: 'default.prod.ts' },
          { replace: 'env.ts', with: 'env.prod.ts' },
        ]);
      });

      it('should spread top-level arrays like inputs using "..."', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.inputs': ['dummy', 'dummy.ts'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: ['default', '{projectRoot}/**/*'],
              },
            },
          },
          {
            inputs: ['production', '...', '{workspaceRoot}/.eslintrc.json'],
          },
          sourceMap
        );

        expect(result.inputs).toEqual([
          'production',
          'default',
          '{projectRoot}/**/*',
          '{workspaceRoot}/.eslintrc.json',
        ]);
      });

      it('should let project.json override target defaults for core plugin targets', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['project.json', 'nx/core/project-json'],
          'targets.build': ['project.json', 'nx/core/project-json'],
          'targets.build.options': ['project.json', 'nx/core/project-json'],
          'targets.build.options.command': [
            'project.json',
            'nx/core/project-json',
          ],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  command: 'echo hello',
                },
              },
            },
          },
          {
            options: {
              command: 'echo world',
            },
          },
          sourceMap
        );

        // Core plugin source means project definition takes precedence
        expect(result.options.command).toEqual('echo hello');
      });

      it('should let project.json override target default arrays for core plugin targets', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['project.json', 'nx/core/project-json'],
          'targets.build': ['project.json', 'nx/core/project-json'],
          'targets.build.inputs': ['project.json', 'nx/core/project-json'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                inputs: ['default', '{projectRoot}/**/*'],
              },
            },
          },
          {
            inputs: ['production', '{workspaceRoot}/.eslintrc.json'],
          },
          sourceMap
        );

        // Core plugin source means project definition takes precedence
        expect(result.inputs).toEqual(['default', '{projectRoot}/**/*']);
      });

      it('should ignore "..." in base target definition when target default overrides without spread', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.options': ['dummy', 'dummy.ts'],
          'targets.build.options.assets': ['dummy', 'dummy.ts'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  assets: ['project-asset', '...'],
                },
              },
            },
          },
          {
            options: {
              assets: ['default-asset-1', 'default-asset-2'],
            },
          },
          sourceMap
        );

        // Target defaults override non-core plugin values, and the '...' in the
        // project definition is irrelevant since the target default has no spread
        expect(result.options.assets).toEqual([
          'default-asset-1',
          'default-asset-2',
        ]);
      });

      it('should ignore "..." in base target definition object when target default overrides without spread', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['dummy', 'dummy.ts'],
          'targets.build': ['dummy', 'dummy.ts'],
          'targets.build.options': ['dummy', 'dummy.ts'],
          'targets.build.options.env': ['dummy', 'dummy.ts'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    '...': true,
                    PROJECT_VAR: 'project',
                  },
                },
              },
            },
          },
          {
            options: {
              env: {
                DEFAULT_VAR: 'default',
              },
            },
          },
          sourceMap
        );

        // Target defaults override non-core, and the '...' in project definition
        // doesn't affect the result since the override has no spread
        expect(result.options.env).toEqual({
          DEFAULT_VAR: 'default',
        });
      });

      it('should track per-element source for array spread in target default options', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['project.json', 'my-plugin'],
          'targets.build': ['project.json', 'my-plugin'],
          'targets.build.options': ['project.json', 'my-plugin'],
          'targets.build.options.assets': ['project.json', 'my-plugin'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  assets: ['project-asset'],
                },
              },
            },
          },
          {
            options: {
              assets: ['default-asset-1', '...', 'default-asset-2'],
            },
          },
          sourceMap
        );

        expect(result.options.assets).toEqual([
          'default-asset-1',
          'project-asset',
          'default-asset-2',
        ]);
        // Parent key is attributed to target defaults (new source)
        expect(sourceMap['targets.build.options.assets']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
        // Per-element tracking
        expect(sourceMap['targets.build.options.assets.0']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
        expect(sourceMap['targets.build.options.assets.1']).toEqual([
          'project.json',
          'my-plugin',
        ]);
        expect(sourceMap['targets.build.options.assets.2']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
      });

      it('should track per-property source for object spread in target default options', () => {
        const sourceMap: Record<string, SourceInformation> = {
          targets: ['project.json', 'my-plugin'],
          'targets.build': ['project.json', 'my-plugin'],
          'targets.build.options': ['project.json', 'my-plugin'],
          'targets.build.options.env': ['project.json', 'my-plugin'],
        };
        const result = mergeTargetDefaultWithTargetDefinition(
          'build',
          {
            name: 'myapp',
            root: 'apps/myapp',
            targets: {
              build: {
                executor: 'nx:run-commands',
                options: {
                  env: {
                    PROJECT_VAR: 'project-value',
                    SHARED: 'project-shared',
                  },
                },
              },
            },
          },
          {
            options: {
              env: {
                DEFAULT_VAR: 'default-value',
                '...': true,
                SHARED: 'default-shared',
              },
            },
          },
          sourceMap
        );

        expect(result.options.env).toEqual({
          DEFAULT_VAR: 'default-value',
          PROJECT_VAR: 'project-value',
          SHARED: 'default-shared',
        });
        expect(sourceMap['targets.build.options.env']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
        expect(sourceMap['targets.build.options.env.DEFAULT_VAR']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
        expect(sourceMap['targets.build.options.env.PROJECT_VAR']).toEqual([
          'project.json',
          'my-plugin',
        ]);
        // SHARED is defined after '...', so target defaults win
        expect(sourceMap['targets.build.options.env.SHARED']).toEqual([
          'nx.json',
          'nx/target-defaults',
        ]);
      });
    });
  });

  describe('mergeProjectConfigurationIntoRootMap spread syntax', () => {
    it('should spread arrays in target options when merging projects', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                scripts: ['existing-script-1', 'existing-script-2'],
              },
            },
          },
        })
        .getRootMap();

      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            options: {
              scripts: ['new-script', '...'],
            },
          },
        },
      });

      expect(rootMap['libs/lib-a'].targets?.build.options.scripts).toEqual([
        'new-script',
        'existing-script-1',
        'existing-script-2',
      ]);
    });

    it('should spread objects in target options when merging projects', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                env: {
                  EXISTING_VAR: 'existing',
                  SHARED_VAR: 'existing-shared',
                },
              },
            },
          },
        })
        .getRootMap();

      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            options: {
              env: {
                NEW_VAR: 'new',
                '...': true,
                SHARED_VAR: 'new-shared',
              },
            },
          },
        },
      });

      expect(rootMap['libs/lib-a'].targets?.build.options.env).toEqual({
        NEW_VAR: 'new',
        EXISTING_VAR: 'existing',
        SHARED_VAR: 'new-shared',
      });
    });

    it('should spread arrays in top-level target properties when merging projects', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              inputs: ['default', '{projectRoot}/**/*'],
              outputs: ['{projectRoot}/dist'],
              dependsOn: ['^build'],
            },
          },
        })
        .getRootMap();

      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            inputs: ['production', '...'],
            outputs: ['...', '{projectRoot}/coverage'],
            dependsOn: ['prebuild', '...'],
          },
        },
      });

      expect(rootMap['libs/lib-a'].targets?.build.inputs).toEqual([
        'production',
        'default',
        '{projectRoot}/**/*',
      ]);
      expect(rootMap['libs/lib-a'].targets?.build.outputs).toEqual([
        '{projectRoot}/dist',
        '{projectRoot}/coverage',
      ]);
      expect(rootMap['libs/lib-a'].targets?.build.dependsOn).toEqual([
        'prebuild',
        '^build',
      ]);
    });

    it('should spread arrays in configuration options when merging projects', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              configurations: {
                prod: {
                  fileReplacements: [
                    { replace: 'env.ts', with: 'env.prod.ts' },
                  ],
                },
              },
            },
          },
        })
        .getRootMap();

      mergeProjectConfigurationIntoRootMap(rootMap, {
        root: 'libs/lib-a',
        name: 'lib-a',
        targets: {
          build: {
            configurations: {
              prod: {
                fileReplacements: [
                  { replace: 'config.ts', with: 'config.prod.ts' },
                  '...',
                ],
              },
            },
          },
        },
      });

      expect(
        rootMap['libs/lib-a'].targets?.build.configurations?.prod
          .fileReplacements
      ).toEqual([
        { replace: 'config.ts', with: 'config.prod.ts' },
        { replace: 'env.ts', with: 'env.prod.ts' },
      ]);
    });

    it('should handle spread with source maps correctly', () => {
      const rootMap = new RootMapBuilder()
        .addProject({
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              executor: 'nx:run-commands',
              options: {
                scripts: ['base-script'],
              },
            },
          },
        })
        .getRootMap();
      const sourceMap: ConfigurationSourceMaps = {
        'libs/lib-a': {
          'targets.build': ['base', 'base-plugin'],
          'targets.build.options': ['base', 'base-plugin'],
          'targets.build.options.scripts': ['base', 'base-plugin'],
        },
      };

      mergeProjectConfigurationIntoRootMap(
        rootMap,
        {
          root: 'libs/lib-a',
          name: 'lib-a',
          targets: {
            build: {
              options: {
                scripts: ['new-script', '...'],
              },
            },
          },
        },
        sourceMap,
        ['new', 'new-plugin']
      );

      expect(rootMap['libs/lib-a'].targets?.build.options.scripts).toEqual([
        'new-script',
        'base-script',
      ]);
      expect(sourceMap['libs/lib-a']['targets.build.options.scripts']).toEqual([
        'new',
        'new-plugin',
      ]);
      // Per-element source tracking
      expect(
        sourceMap['libs/lib-a']['targets.build.options.scripts.0']
      ).toEqual(['new', 'new-plugin']);
      expect(
        sourceMap['libs/lib-a']['targets.build.options.scripts.1']
      ).toEqual(['base', 'base-plugin']);
    });
  });

  describe('two-phase spread: project.json spread includes target defaults', () => {
    const projectJsonPaths = ['libs/my-lib/project.json'];

    /**
     * Creates a specified plugin that infers targets for a project.
     * Simulates plugins like @nx/webpack, @nx/jest, etc.
     */
    function makeSpecifiedPlugin(
      targets: Record<string, TargetConfiguration>,
      projectRoot = 'libs/my-lib'
    ): NxPluginV2 {
      return {
        name: 'specified-plugin',
        createNodesV2: [
          'libs/*/project.json',
          (configFiles) =>
            createNodesFromFiles(
              (configFile) => {
                const root = dirname(configFile);
                if (root !== projectRoot) return {};
                return {
                  projects: {
                    [root]: { targets },
                  },
                };
              },
              configFiles,
              {} as any,
              {} as any
            ),
        ],
      };
    }

    /**
     * Creates a default plugin (like project.json) that defines targets.
     */
    function makeDefaultPlugin(
      targets: Record<string, TargetConfiguration>,
      projectRoot = 'libs/my-lib',
      name = 'default-plugin'
    ): NxPluginV2 {
      return {
        name,
        createNodesV2: [
          'libs/*/project.json',
          (configFiles) =>
            createNodesFromFiles(
              (configFile) => {
                const root = dirname(configFile);
                if (root !== projectRoot) return {};
                return {
                  projects: {
                    [root]: {
                      name: 'my-lib',
                      targets,
                    },
                  },
                };
              },
              configFiles,
              {} as any,
              {} as any
            ),
        ],
      };
    }

    it('Case C: spread in project.json target includes target defaults (specified + defaults)', async () => {
      // Scenario: Specified plugin infers build.inputs, target defaults define
      // build.inputs, project.json uses spread to include defaults.
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          inputs: ['inferred'],
          options: { command: 'echo build' },
        },
      });

      const defaultPlugin = makeDefaultPlugin({
        build: {
          inputs: ['explicit', '...'],
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              inputs: ['default'],
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // project.json spread expands with (specified + target defaults)
      // Since target defaults override specified: base is ['default']
      // project.json merges ['explicit', '...'] on top → ['explicit', 'default']
      expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
        'explicit',
        'default',
      ]);
    });

    it('Case B: spread in project.json-only target includes target defaults', async () => {
      // Scenario: No specified plugin defines the target, only project.json
      // does. The spread should expand with target defaults.
      const defaultPlugin = makeDefaultPlugin({
        deploy: {
          executor: 'nx:run-commands',
          inputs: ['explicit', '...'],
          options: { command: 'echo deploy' },
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            deploy: {
              inputs: ['default'],
            },
          },
        },
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // project.json spread expands with target defaults (no specified values)
      // Base is ['default'], project.json merges ['explicit', '...'] on top
      expect(projects['libs/my-lib'].targets!.deploy.inputs).toEqual([
        'explicit',
        'default',
      ]);
    });

    it('Case C without spread: project.json fully replaces (existing behavior)', async () => {
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          inputs: ['inferred'],
          options: { command: 'echo build' },
        },
      });

      const defaultPlugin = makeDefaultPlugin({
        build: {
          inputs: ['explicit'],
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              inputs: ['default'],
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // No spread: project.json fully replaces
      expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
        'explicit',
      ]);
    });

    it('Case A: target defaults override specified plugin (no project.json target)', async () => {
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          inputs: ['inferred'],
          options: { command: 'echo build' },
        },
      });

      const defaultPlugin = makeDefaultPlugin({});

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              inputs: ['default'],
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // Target defaults override specified plugin values
      expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
        'default',
      ]);
    });

    it('Case A: target defaults with spread include specified plugin values', async () => {
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          inputs: ['inferred'],
          options: { command: 'echo build' },
        },
      });

      const defaultPlugin = makeDefaultPlugin({});

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              inputs: ['default', '...'],
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // Target defaults spread includes specified plugin values
      expect(projects['libs/my-lib'].targets!.build.inputs).toEqual([
        'default',
        'inferred',
      ]);
    });

    it('Case B without spread: project.json fully replaces target defaults', async () => {
      const defaultPlugin = makeDefaultPlugin({
        deploy: {
          executor: 'nx:run-commands',
          inputs: ['explicit'],
          options: { command: 'echo deploy' },
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            deploy: {
              inputs: ['default'],
            },
          },
        },
        {
          specifiedPluginFiles: [],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // No spread: project.json fully replaces target defaults
      expect(projects['libs/my-lib'].targets!.deploy.inputs).toEqual([
        'explicit',
      ]);
    });

    it('full three-layer spread chain', async () => {
      // All three layers have values and use spread
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo build',
            assets: ['inferred'],
          },
        },
      });

      const defaultPlugin = makeDefaultPlugin({
        build: {
          options: {
            assets: ['explicit', '...'],
          },
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              options: {
                assets: ['default', '...'],
              },
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // Three-layer chain:
      // 1. Specified: ['inferred']
      // 2. Target defaults: ['default', '...'] → ['default', 'inferred']
      // 3. project.json: ['explicit', '...'] → ['explicit', 'default', 'inferred']
      expect(projects['libs/my-lib'].targets!.build.options.assets).toEqual([
        'explicit',
        'default',
        'inferred',
      ]);
    });

    it('spread in project.json options includes target default options', async () => {
      const specifiedPlugin = makeSpecifiedPlugin({
        build: {
          executor: 'nx:run-commands',
          options: {
            command: 'echo build',
            env: { SPECIFIED: 'true' },
          },
        },
      });

      const defaultPlugin = makeDefaultPlugin({
        build: {
          options: {
            env: { PROJECT: 'true', '...': true },
          },
        },
      });

      const { projects } = await createProjectConfigurationsWithPlugins(
        undefined,
        {
          targetDefaults: {
            build: {
              options: {
                env: { DEFAULT: 'true', '...': true },
              },
            },
          },
        },
        {
          specifiedPluginFiles: [projectJsonPaths],
          defaultPluginFiles: [projectJsonPaths],
        },
        {
          specifiedPlugins: [
            new LoadedNxPlugin(specifiedPlugin, 'specified-plugin'),
          ],
          defaultPlugins: [new LoadedNxPlugin(defaultPlugin, 'default-plugin')],
        }
      );

      // Object spread through all three layers:
      // 1. Specified: { SPECIFIED: 'true' }
      // 2. Target defaults: { DEFAULT: 'true', '...': true } → { DEFAULT: 'true', SPECIFIED: 'true' }
      // 3. project.json: { PROJECT: 'true', '...': true } → { PROJECT: 'true', DEFAULT: 'true', SPECIFIED: 'true' }
      expect(projects['libs/my-lib'].targets!.build.options.env).toEqual({
        PROJECT: 'true',
        DEFAULT: 'true',
        SPECIFIED: 'true',
      });
    });
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
      throw new Error(
        `Assertion failed for key '${key}': \n ${(error as Error).message}`
      );
    }
  });
}
