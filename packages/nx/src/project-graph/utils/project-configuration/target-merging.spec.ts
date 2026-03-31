import { TargetConfiguration } from '../../../config/workspace-json-project-json';
import {
  isCompatibleTarget,
  mergeTargetConfigurations,
} from './target-merging';
import { readTargetDefaultsForTarget } from '../project-configuration-utils/target-defaults';
import type { SourceInformation } from './source-maps';

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
      readTargetDefaultsForTarget('e2e-ci--file-foo', targetDefaults, null)
        .options['key']
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
});

describe('spread syntax in mergeTargetConfigurations', () => {
  it('should spread arrays in top-level target properties', () => {
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
        inputs: ['production', '...', '{workspaceRoot}/.eslintrc.json'],
      },
      {
        executor: 'nx:run-commands',
        inputs: ['default', '{projectRoot}/**/*'],
      }
    );

    expect(result.inputs).toEqual([
      'production',
      'default',
      '{projectRoot}/**/*',
      '{workspaceRoot}/.eslintrc.json',
    ]);
  });

  it('should spread arrays in options', () => {
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
        options: {
          assets: ['new-asset', '...', 'trailing-asset'],
        },
      },
      {
        executor: 'nx:run-commands',
        options: {
          assets: ['base-asset-1', 'base-asset-2'],
        },
      }
    );

    expect(result.options.assets).toEqual([
      'new-asset',
      'base-asset-1',
      'base-asset-2',
      'trailing-asset',
    ]);
  });

  it('should spread objects in options using "..." key', () => {
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
        options: {
          env: {
            NEW_VAR: 'new-value',
            '...': true,
            OVERRIDE_VAR: 'overridden',
          },
        },
      },
      {
        executor: 'nx:run-commands',
        options: {
          env: {
            BASE_VAR: 'base-value',
            OVERRIDE_VAR: 'original',
          },
        },
      }
    );

    expect(result.options.env).toEqual({
      NEW_VAR: 'new-value',
      BASE_VAR: 'base-value',
      OVERRIDE_VAR: 'overridden',
    });
  });

  it('should spread arrays in configurations', () => {
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
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
        executor: 'nx:run-commands',
        configurations: {
          prod: {
            fileReplacements: [{ replace: 'env.ts', with: 'env.prod.ts' }],
          },
        },
      }
    );

    expect(result.configurations.prod.fileReplacements).toEqual([
      { replace: 'new.ts', with: 'new.prod.ts' },
      { replace: 'env.ts', with: 'env.prod.ts' },
    ]);
  });

  it('should track source map entries for spread array elements', () => {
    const sourceMap: Record<string, SourceInformation> = {
      'targets.build': ['base.json', 'base-plugin'],
      'targets.build.inputs': ['base.json', 'base-plugin'],
    };
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
        inputs: ['new-input', '...', 'trailing-input'],
      },
      {
        executor: 'nx:run-commands',
        inputs: ['base-input'],
      },
      sourceMap,
      ['nx.json', 'override-plugin'],
      'targets.build'
    );

    expect(result.inputs).toEqual([
      'new-input',
      'base-input',
      'trailing-input',
    ]);
    // Parent key attributed to the new source
    expect(sourceMap['targets.build.inputs']).toEqual([
      'nx.json',
      'override-plugin',
    ]);
    // Per-element tracking
    expect(sourceMap['targets.build.inputs.0']).toEqual([
      'nx.json',
      'override-plugin',
    ]);
    expect(sourceMap['targets.build.inputs.1']).toEqual([
      'base.json',
      'base-plugin',
    ]);
    expect(sourceMap['targets.build.inputs.2']).toEqual([
      'nx.json',
      'override-plugin',
    ]);
  });

  it('should replace array without spread token', () => {
    const result = mergeTargetConfigurations(
      {
        executor: 'nx:run-commands',
        inputs: ['only-new-input'],
      },
      {
        executor: 'nx:run-commands',
        inputs: ['base-input-1', 'base-input-2'],
      }
    );

    expect(result.inputs).toEqual(['only-new-input']);
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
