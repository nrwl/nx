import 'nx/src/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  addProjectConfiguration,
  type NxJsonConfiguration,
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
});
