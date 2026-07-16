import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  type NxJsonConfiguration,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
import { dump } from '@zkochan/js-yaml';

import update from './convert-to-flat-config';

describe('convert-to-flat-config migration', () => {
  let tree: Tree;
  let originalEslintUseFlatConfigVal: string | undefined;

  beforeEach(() => {
    // The conversion needs an eslintrc workspace to convert from, so force the
    // generators that build the fixture to emit eslintrc rather than flat config.
    originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = { lint: { inputs: ['default'] } };
      json.namedInputs = {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: ['default'],
        sharedGlobals: [],
      };
      return json;
    });
  });

  afterEach(() => {
    if (originalEslintUseFlatConfigVal === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEslintUseFlatConfigVal;
    }
  });

  it('should be a no-op when there is no ESLint configuration', async () => {
    const result = await update(tree);

    expect(result).toBeUndefined();
  });

  it('should convert a JSON eslintrc workspace and return the passing-state baseline', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, rules: { 'no-console': 'error' } })
    );

    const result = await update(tree);

    // Deterministic conversion ran.
    expect(tree.exists('eslint.config.mjs')).toBeTruthy();
    expect(tree.exists('.eslintrc.json')).toBeFalsy();
    // The user's explicit rule is carried into the passing-state baseline.
    expect(result).toBeDefined();
    expect(
      result!.agentContext.some(
        (entry) =>
          entry.includes('Passing-state requirement') &&
          entry.includes('no-console')
      )
    ).toBe(true);
  });

  it('should convert every project in a multi-project workspace (mixed JSON and YAML)', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true, rules: {} }));

    const addLib = (name: string, configFile: string, content: string) => {
      const root = `libs/${name}`;
      addProjectConfiguration(tree, name, {
        root,
        targets: {
          lint: {
            executor: '@nx/eslint:lint',
            options: { lintFilePatterns: [root] },
          },
        },
      });
      tree.write(`${root}/${configFile}`, content);
    };

    addLib(
      'lib-a',
      '.eslintrc.json',
      JSON.stringify({ rules: { 'no-console': 'error' } })
    );
    addLib(
      'lib-b',
      '.eslintrc.json',
      JSON.stringify({ rules: { 'no-debugger': 'error' } })
    );
    addLib('lib-c', '.eslintrc.yaml', dump({ rules: { 'no-alert': 'error' } }));

    const result = await update(tree);

    // Root and all three projects converted; every eslintrc removed.
    expect(tree.exists('eslint.config.mjs')).toBeTruthy();
    expect(tree.exists('.eslintrc.json')).toBeFalsy();
    for (const name of ['lib-a', 'lib-b', 'lib-c']) {
      expect(tree.exists(`libs/${name}/eslint.config.mjs`)).toBeTruthy();
    }
    expect(tree.exists('libs/lib-a/.eslintrc.json')).toBeFalsy();
    expect(tree.exists('libs/lib-b/.eslintrc.json')).toBeFalsy();
    expect(tree.exists('libs/lib-c/.eslintrc.yaml')).toBeFalsy();
    expect(result).toBeDefined();
    // Every project's explicit rules, including the YAML project's, reach the
    // passing-state baseline (covers multi-project and YAML rule collection).
    const baseline = result!.agentContext.find((entry) =>
      entry.includes('Passing-state requirement')
    );
    expect(baseline).toContain('no-console');
    expect(baseline).toContain('no-debugger');
    expect(baseline).toContain('no-alert');
  });

  it.each(['.eslintrc.js', '.eslintrc.cjs'])(
    'should route a %s root config to the prompt without converting',
    async (jsConfig) => {
      tree.write(jsConfig, 'module.exports = { root: true };');

      const result = await update(tree);

      // The generator is not called, so nothing is converted (and it does not throw).
      expect(tree.exists('eslint.config.mjs')).toBeFalsy();
      expect(tree.exists(jsConfig)).toBeTruthy();
      expect(result).toBeDefined();
      expect(
        result!.agentContext.some((entry) =>
          entry.includes('root ESLint config is JavaScript-based')
        )
      ).toBe(true);
      expect(
        result!.nextSteps.some((step) =>
          step.includes('root ESLint config is JavaScript-based')
        )
      ).toBe(true);
    }
  );

  it('should be a no-op conversion but still return context when already on flat config', async () => {
    tree.write('eslint.config.mjs', 'module.exports = [];');

    const result = await update(tree);

    expect(result).toBeDefined();
    // Passing-state baseline is always provided (v9 default changes can newly fail).
    expect(
      result!.agentContext.some((entry) =>
        entry.includes('Passing-state requirement')
      )
    ).toBe(true);
    // No conversion-only context when nothing was converted.
    expect(
      result!.agentContext.some((entry) => entry.includes('FlatCompat'))
    ).toBe(false);
  });

  it('reconciles angular-eslint v22 removed refs in an already-flat config', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': '^22.0.0',
      };
      return json;
    });
    tree.write(
      'eslint.config.mjs',
      `import nx from '@nx/eslint-plugin';
import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...nx.configs['flat/angular'],
  ...compat.extends('plugin:@angular-eslint/template/process-inline-templates'),
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );

    await update(tree);

    const content = tree.read('eslint.config.mjs', 'utf-8');
    expect(content).not.toContain('no-conflicting-lifecycle');
    expect(content).not.toContain('process-inline-templates');
    expect(content).not.toContain('FlatCompat');
    expect(content).toContain("import angular from 'angular-eslint'");
    expect(content).toContain('processor: angular.processInlineTemplates');
  });

  it('reconciles angular-eslint v22 exactly once when converting an eslintrc root', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': '^22.0.0',
      };
      return json;
    });
    tree.write(
      '.eslintrc.json',
      JSON.stringify({
        root: true,
        extends: ['plugin:@angular-eslint/recommended'],
      })
    );

    await update(tree);

    // The generator converts the root and reconciles the shim during conversion,
    // so the migration's explicit second pass is a no-op: the import is injected
    // once and the dependency added once, not duplicated.
    const content = tree.read('eslint.config.mjs', 'utf-8');
    expect(content).toContain('...angular.configs.tsRecommended');
    expect(content).not.toContain('FlatCompat');
    expect(
      content.match(/import angular from ['"]angular-eslint['"]/g)
    ).toHaveLength(1);
    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['angular-eslint']).toMatch(/^\^22\./);
  });

  it('leaves angular-eslint refs intact before v22 (rule is still valid)', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': '^21.0.0',
      };
      return json;
    });
    tree.write(
      'eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );

    await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toContain(
      'no-conflicting-lifecycle'
    );
  });

  it('reconciles project flat configs even when the root config is JavaScript-based', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': '^22.0.0',
      };
      return json;
    });
    // A JavaScript-based root config makes rootState 'js', so the generator does
    // not run; a project already on flat config must still be reconciled.
    tree.write('.eslintrc.js', 'module.exports = { root: true };');
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );

    await update(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).not.toContain(
      'no-conflicting-lifecycle'
    );
  });

  it('reconciles project flat configs even when there is no root config', async () => {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = {
        ...json.devDependencies,
        '@angular-eslint/eslint-plugin': '^22.0.0',
      };
      return json;
    });
    // No root ESLint config of any shape makes rootState 'none'; a project
    // already on flat config must still be reconciled, not skipped by the
    // no-root-config early return.
    tree.write(
      'apps/app/eslint.config.mjs',
      `export default [
  {
    files: ['**/*.ts'],
    rules: { '@angular-eslint/no-conflicting-lifecycle': 'error' },
  },
];
`
    );

    await update(tree);

    expect(tree.read('apps/app/eslint.config.mjs', 'utf-8')).not.toContain(
      'no-conflicting-lifecycle'
    );
  });

  it.each(['.eslintrc.js', '.eslintrc.cjs'])(
    'should surface project configs that are JavaScript-based (%s) and were skipped',
    async (jsConfig) => {
      tree.write('.eslintrc.json', JSON.stringify({ root: true }));
      addProjectConfiguration(tree, 'js-lib', {
        root: 'libs/js-lib',
        targets: {},
      });
      tree.write(`libs/js-lib/${jsConfig}`, 'module.exports = {};');

      const result = await update(tree);

      expect(result).toBeDefined();
      expect(
        result!.agentContext.some((entry) =>
          entry.includes(`libs/js-lib/${jsConfig}`)
        )
      ).toBe(true);
      expect(
        result!.nextSteps.some((step) =>
          step.includes(`libs/js-lib/${jsConfig}`)
        )
      ).toBe(true);
    }
  );

  it('should collect explicit rules from YAML configs and overrides for the passing baseline', async () => {
    tree.write(
      '.eslintrc.yaml',
      dump({
        root: true,
        rules: { 'no-console': 'error' },
        overrides: [{ files: ['*.ts'], rules: { 'no-debugger': 'warn' } }],
      })
    );

    const result = await update(tree);

    expect(result).toBeDefined();
    const baseline = result!.agentContext.find((entry) =>
      entry.includes('Passing-state requirement')
    );
    expect(baseline).toContain('no-console');
    expect(baseline).toContain('no-debugger');
  });

  it('should advise on FlatCompat only when the generated config actually uses it', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, extends: ['plugin:storybook/recommended'] })
    );

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(tree.exists('eslint.config.mjs')).toBeTruthy();
    expect(
      result!.agentContext.some((entry) => entry.includes('FlatCompat'))
    ).toBe(true);
  });

  it('should surface lint targets using a removed ESLint formatter', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    addProjectConfiguration(tree, 'fmt-lib', {
      root: 'libs/fmt-lib',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: { format: 'compact', lintFilePatterns: ['libs/fmt-lib'] },
        },
      },
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some(
        (entry) =>
          entry.includes('removed in v9') &&
          entry.includes('fmt-lib:lint (format: "compact")')
      )
    ).toBe(true);
    expect(
      result!.nextSteps.some((step) =>
        step.includes('fmt-lib:lint (format: "compact")')
      )
    ).toBe(true);
  });

  it('should surface a removed formatter set only on a target configuration', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    addProjectConfiguration(tree, 'ci-lib', {
      root: 'libs/ci-lib',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: { lintFilePatterns: ['libs/ci-lib'] },
          configurations: { ci: { format: 'junit' } },
        },
      },
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some((entry) =>
        entry.includes('ci-lib:lint:ci (format: "junit")')
      )
    ).toBe(true);
  });

  it('should surface a removed formatter set in nx.json targetDefaults', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        ...json.targetDefaults,
        lint: { ...json.targetDefaults?.lint, options: { format: 'junit' } },
      };
      return json;
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some(
        (entry) =>
          entry.includes('removed in v9') &&
          entry.includes('targetDefaults["lint"] (format: "junit")')
      )
    ).toBe(true);
    expect(
      result!.nextSteps.some((step) =>
        step.includes('targetDefaults["lint"] (format: "junit")')
      )
    ).toBe(true);
  });

  it('should surface a removed formatter set on an executor-keyed targetDefaults configuration', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        ...json.targetDefaults,
        '@nx/eslint:lint': { configurations: { ci: { format: 'compact' } } },
      };
      return json;
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some((entry) =>
        entry.includes(
          'targetDefaults["@nx/eslint:lint"]:ci (format: "compact")'
        )
      )
    ).toBe(true);
  });

  it('should convert a base-only root config without a sibling .eslintrc.json', async () => {
    tree.write(
      '.eslintrc.base.json',
      JSON.stringify({ root: true, rules: { 'no-console': 'error' } })
    );

    const result = await update(tree);

    // The base config is converted and the original removed; no sibling root
    // config existed, so none is fabricated (and the migration does not throw).
    expect(tree.exists('eslint.base.config.mjs')).toBeTruthy();
    expect(tree.exists('.eslintrc.base.json')).toBeFalsy();
    expect(tree.exists('eslint.config.mjs')).toBeFalsy();
    expect(result).toBeDefined();
  });

  it('should surface a flat-config-unsupported option inherited from nx.json targetDefaults', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        ...json.targetDefaults,
        lint: {
          ...json.targetDefaults?.lint,
          options: { ignorePath: '.eslintignore' },
        },
      };
      return json;
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some(
        (entry) =>
          entry.includes('flat config no longer supports') &&
          entry.includes('targetDefaults["lint"] (ignorePath)')
      )
    ).toBe(true);
    expect(
      result!.nextSteps.some((step) =>
        step.includes('targetDefaults["lint"] (ignorePath)')
      )
    ).toBe(true);
  });

  it('should surface an unsupported option on an executor-keyed targetDefaults configuration', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        ...json.targetDefaults,
        '@nx/eslint:lint': {
          configurations: { ci: { resolvePluginsRelativeTo: '.' } },
        },
      };
      return json;
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some((entry) =>
        entry.includes(
          'targetDefaults["@nx/eslint:lint"]:ci (resolvePluginsRelativeTo)'
        )
      )
    ).toBe(true);
  });

  it('should surface project lint options the generator leaves but not the ignorePath it strips', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    tree.write('libs/opt-lib/.eslintrc.json', JSON.stringify({ rules: {} }));
    addProjectConfiguration(tree, 'opt-lib', {
      root: 'libs/opt-lib',
      targets: {
        lint: {
          executor: '@nx/eslint:lint',
          options: {
            lintFilePatterns: ['libs/opt-lib'],
            ignorePath: 'libs/opt-lib/.eslintignore',
            resolvePluginsRelativeTo: '.',
            reportUnusedDisableDirectives: true,
          },
        },
      },
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    const surfaced = result!.nextSteps.find((step) =>
      step.includes('flat config no longer supports')
    );
    expect(surfaced).toContain('opt-lib:lint (resolvePluginsRelativeTo)');
    expect(surfaced).toContain('opt-lib:lint (reportUnusedDisableDirectives)');
    // The generator folds project-level ignorePath into the flat config ignores,
    // so it must not be reported as an unsupported leftover.
    expect(surfaced).not.toContain('opt-lib:lint (ignorePath)');
  });

  it('should not surface reportUnusedDisableDirectives when it is disabled', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true }));
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        ...json.targetDefaults,
        lint: {
          ...json.targetDefaults?.lint,
          options: { reportUnusedDisableDirectives: false },
        },
      };
      return json;
    });

    const result = await update(tree);

    expect(result).toBeDefined();
    expect(
      result!.agentContext.some((entry) =>
        entry.includes('reportUnusedDisableDirectives')
      )
    ).toBe(false);
  });
});
