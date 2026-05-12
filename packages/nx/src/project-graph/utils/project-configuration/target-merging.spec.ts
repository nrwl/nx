import { TargetConfiguration } from '../../../config/workspace-json-project-json';
import {
  isCompatibleTarget,
  mergeTargetConfigurations,
} from './target-merging';
import { readTargetDefaultsForTarget } from './target-defaults';
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

  describe('options-level spread ("..." key in options object)', () => {
    it('should use object spread semantics when options contains "..." key', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          options: {
            myNewOption: 'new-value',
            '...': true,
            sharedOption: 'overridden',
          },
        },
        {
          executor: 'nx:run-commands',
          options: {
            baseOption: 'base-value',
            sharedOption: 'original',
          },
        }
      );

      // Keys before '...' in new options can be overridden by base;
      // keys after '...' override base. Last-write-wins.
      expect(result.options).toEqual({
        myNewOption: 'new-value',
        baseOption: 'base-value',
        sharedOption: 'overridden',
      });
      // The '...' key itself must not appear in the result
      expect(result.options['...']).toBeUndefined();
    });

    it('should let base win for options keys that appear before "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          options: {
            outputPath: 'dist/my-override',
            '...': true,
          },
        },
        {
          executor: 'nx:run-commands',
          options: {
            outputPath: 'dist/inferred',
            tsConfig: 'tsconfig.app.json',
          },
        }
      );

      // outputPath is before '...' so base wins; tsConfig comes from base via spread
      expect(result.options).toEqual({
        outputPath: 'dist/inferred',
        tsConfig: 'tsconfig.app.json',
      });
    });

    it('should let new options win for keys that appear after "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          options: {
            '...': true,
            outputPath: 'dist/my-override',
          },
        },
        {
          executor: 'nx:run-commands',
          options: {
            outputPath: 'dist/inferred',
            tsConfig: 'tsconfig.app.json',
          },
        }
      );

      // outputPath is after '...' so new options win; tsConfig comes from base
      expect(result.options).toEqual({
        outputPath: 'dist/my-override',
        tsConfig: 'tsconfig.app.json',
      });
    });

    it('should add new options keys that are not in base when "..." is at end', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          options: {
            brandNewOption: 'value',
            '...': true,
          },
        },
        {
          executor: 'nx:run-commands',
          options: {
            existingOption: 'base-value',
          },
        }
      );

      // brandNewOption is not in base so it survives even though it's before '...'
      expect(result.options).toEqual({
        brandNewOption: 'value',
        existingOption: 'base-value',
      });
    });
  });

  describe('target root spread ("..." key in target object)', () => {
    it('should let base win for top-level keys before "..." (only add new keys)', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          dependsOn: ['lint'],
          '...': true,
        },
        {
          executor: 'nx:run-commands',
          dependsOn: ['typecheck'],
          inputs: ['production'],
        }
      );

      // dependsOn is before '...' and exists in base → base wins
      expect(result.dependsOn).toEqual(['typecheck']);
      // inputs is only in base → comes through via spread
      expect(result.inputs).toEqual(['production']);
      // '...' must not appear in the result
      expect((result as any)['...']).toBeUndefined();
    });

    it('should let target win for top-level keys after "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          '...': true,
          dependsOn: ['lint'],
        },
        {
          executor: 'nx:run-commands',
          dependsOn: ['typecheck'],
          inputs: ['production'],
        }
      );

      // dependsOn is after '...' → target wins
      expect(result.dependsOn).toEqual(['lint']);
      // inputs is only in base → comes through via spread
      expect(result.inputs).toEqual(['production']);
    });

    it('should add target-only keys that appear before "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          cache: true,
          '...': true,
        },
        {
          executor: 'nx:run-commands',
          inputs: ['production'],
        }
      );

      // cache is before '...' but NOT in base → it survives as a new addition
      expect(result.cache).toBe(true);
      // inputs comes from base via spread
      expect(result.inputs).toEqual(['production']);
    });

    it('should not spread when targets are not compatible', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:webpack:webpack',
          dependsOn: ['lint'],
          '...': true,
        },
        {
          executor: 'nx:run-commands',
          inputs: ['production'],
        }
      );

      // Incompatible targets: target wins entirely, base is discarded
      // so inputs should not appear (base is ignored)
      expect(result.inputs).toBeUndefined();
      expect(result.dependsOn).toEqual(['lint']);
    });

    it('options are always merged with their own logic regardless of "..." position', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          options: { myOption: 'my-value' },
          '...': true,
        },
        {
          executor: 'nx:run-commands',
          options: { baseOption: 'base-value', myOption: 'base-my-value' },
          inputs: ['production'],
        }
      );

      // options use their own merge logic (not overridden by root spread):
      // target's options wins by default for shared keys
      expect(result.options).toEqual({
        myOption: 'my-value',
        baseOption: 'base-value',
      });
      // inputs: only in base → comes through via root spread
      expect(result.inputs).toEqual(['production']);
    });
  });

  describe('configurations-level spread ("..." key in configurations object)', () => {
    it('should let base win for named configurations before "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          configurations: {
            'my-config': { outputPath: 'dist/custom' },
            '...': true,
          },
        },
        {
          executor: 'nx:run-commands',
          configurations: {
            production: { sourceMap: false },
            development: { sourceMap: true },
          },
        }
      );

      // 'my-config' is before '...' and not in base → survives
      expect(result.configurations['my-config']).toEqual({
        outputPath: 'dist/custom',
      });
      // base named configs come through via spread
      expect(result.configurations['production']).toEqual({ sourceMap: false });
      expect(result.configurations['development']).toEqual({ sourceMap: true });
      expect((result.configurations as any)['...']).toBeUndefined();
    });

    it('should let target win for named configurations after "..."', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          configurations: {
            '...': true,
            production: { outputPath: 'dist/my-override' },
          },
        },
        {
          executor: 'nx:run-commands',
          configurations: {
            production: { sourceMap: false, outputPath: 'dist/base' },
            development: { sourceMap: true },
          },
        }
      );

      // 'production' is after '...' → target options merged with base options (target wins)
      expect(result.configurations['production'].outputPath).toBe(
        'dist/my-override'
      );
      // development comes from base via spread
      expect(result.configurations['development']).toEqual({ sourceMap: true });
    });

    it('should add new named configurations that do not exist in base', () => {
      const result = mergeTargetConfigurations(
        {
          executor: 'nx:run-commands',
          configurations: {
            'my-config': { outputPath: 'dist/custom' },
            '...': true,
          },
        },
        {
          executor: 'nx:run-commands',
          configurations: {
            production: { sourceMap: false },
          },
        }
      );

      // 'my-config' is before '...' but not in base → survives as a new addition
      expect(result.configurations['my-config']).toEqual({
        outputPath: 'dist/custom',
      });
      expect(result.configurations['production']).toEqual({ sourceMap: false });
    });
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

  describe('deferred spread preserves authored key position', () => {
    const NX_SPREAD_TOKEN = '...';

    it('should keep user override winning when the intermediate merge is later applied to a real base (target-level spread)', () => {
      // Simulates the two-pass flow used by default-plugin batches:
      //   pass 1: merge the target against no base with deferSpreadsWithoutBase
      //   pass 2: apply that intermediate target against the real base
      // The canonical idiom `{ '...': true, cache: true }` must keep
      // `cache` *after* the spread in the intermediate object so that the
      // second pass correctly classifies it as "after spread" → new wins.
      const intermediate = mergeTargetConfigurations(
        { [NX_SPREAD_TOKEN]: true, cache: true } as TargetConfiguration,
        undefined,
        undefined,
        undefined,
        'targets.build',
        true // deferSpreadsWithoutBase
      );

      const final = mergeTargetConfigurations(
        intermediate,
        { cache: 'base-value' } as unknown as TargetConfiguration,
        undefined,
        undefined,
        'targets.build'
      );

      expect(final.cache).toBe(true);
    });

    it('should keep configuration override winning through the intermediate merge (configuration-level spread)', () => {
      const intermediate = mergeTargetConfigurations(
        {
          configurations: {
            [NX_SPREAD_TOKEN]: true,
            prod: { optimization: false },
          },
        } as unknown as TargetConfiguration,
        undefined,
        undefined,
        undefined,
        'targets.build',
        true
      );

      const final = mergeTargetConfigurations(
        intermediate,
        {
          configurations: {
            prod: { optimization: true },
          },
        } as unknown as TargetConfiguration,
        undefined,
        undefined,
        'targets.build'
      );

      expect(final.configurations?.prod).toEqual({ optimization: false });
    });
  });
});
