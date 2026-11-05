import '@nx/devkit/internal-testing-utils/mock-project-graph';

import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  NxJsonConfiguration,
  ProjectConfiguration,
  TargetDefaultArrayEntry,
  Tree,
  addProjectConfiguration,
  joinPathFragments,
  logger,
  readJson,
  readProjectConfiguration,
  updateJson,
  updateProjectConfiguration,
} from '@nx/devkit';

import { convertToFlatConfigGenerator } from './generator';
import { ConvertToFlatConfigGeneratorSchema } from './schema';
import { lintProjectGenerator } from '../lint-project/lint-project';
import { eslintrcVersion } from '../../utils/versions';
import { ESLINT_FLAT_CONFIG_FILENAMES } from '../../utils/config-file';
import { dump } from '@zkochan/js-yaml';

function getLintInputs(nxJson: NxJsonConfiguration): string[] {
  const td = nxJson.targetDefaults;
  if (!td) return [];
  const entry = Array.isArray(td)
    ? td.find((e) => e.target === 'lint' || e.target === '@nx/eslint:lint')
    : (td['lint'] ?? td['@nx/eslint:lint']);
  return (entry?.inputs ?? []) as string[];
}

describe('convert-to-flat-config generator', () => {
  let tree: Tree;
  let originalEslintUseFlatConfigVal: string | undefined;

  // TODO(@meeroslav): add plugin in these tests

  beforeEach(() => {
    // The conversion needs an eslintrc workspace to convert from, so force the
    // generators that build the fixture to emit eslintrc rather than flat config.
    originalEslintUseFlatConfigVal = process.env.ESLINT_USE_FLAT_CONFIG;
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test-lib', {
      root: 'libs/test-lib',
      targets: {},
    });
    updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
      json.targetDefaults = {
        lint: {
          inputs: ['default'],
        },
      };
      json.namedInputs = {
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: [
          'default',
          '!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)',
        ],
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

  describe('CJS', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'cjs',
    };
    it('should update dependencies', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
      });
      await convertToFlatConfigGenerator(tree, options);

      // The @nx/* versions come from nxVersion, which self-resolves to
      // packages/eslint/package.json - a file `nx-release --local` rewrites in CI.
      expect(readJson(tree, 'package.json')).toEqual({
        name: '@proj/source',
        dependencies: {},
        devDependencies: {
          '@nx/eslint': expect.anything(),
          '@nx/eslint-plugin': expect.anything(),
          '@typescript-eslint/eslint-plugin': '^8.58.0',
          '@typescript-eslint/parser': '^8.58.0',
          eslint: '^9.8.0',
          'eslint-config-prettier': '^10.0.0',
          'typescript-eslint': '^8.58.0',
        },
      });
    });

    it('should convert json successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.cjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.cjs'
      );
    });

    it('should convert yaml successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        eslintFilePatterns: ['**/*.ts'],
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      const yamlContent = dump(readJson(tree, 'libs/test-lib/.eslintrc.json'));
      tree.delete('libs/test-lib/.eslintrc.json');
      tree.write('libs/test-lib/.eslintrc.yaml', yamlContent);

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.cjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.cjs'
      );
    });

    it('should convert yml successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        eslintFilePatterns: ['**/*.ts'],
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      const yamlContent = dump(readJson(tree, 'libs/test-lib/.eslintrc.json'));
      tree.delete('libs/test-lib/.eslintrc.json');
      tree.write('libs/test-lib/.eslintrc.yml', yamlContent);

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.cjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.cjs'
      );
    });

    it('should add plugin extends', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:storybook/recommended'];
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
        "const { FlatCompat } = require('@eslint/eslintrc');
        const js = require('@eslint/js');
        const nx = require('@nx/eslint-plugin');

        const compat = new FlatCompat({
          baseDirectory: __dirname,
          recommendedConfig: js.configs.recommended,
        });

        module.exports = [
          ...compat.extends('plugin:storybook/recommended'),
          ...nx.configs['flat/base'],
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            rules: {
              '@nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    {
                      sourceTag: '*',
                      onlyDependOnLibsWithTags: ['*'],
                    },
                  ],
                },
              ],
            },
          },
          ...nx.configs['flat/typescript'],
          ...nx.configs['flat/javascript'],
        ];
        "
      `);
      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require('../../eslint.config.cjs');

        module.exports = [
          ...baseConfig,
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.ts', '**/*.tsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
        ];
        "
      `);
      expect(
        readJson(tree, 'package.json').devDependencies['@eslint/eslintrc']
      ).toEqual(eslintrcVersion);
    });

    it('adds the umbrella angular-eslint package when converting a config that uses the @nx/angular preset', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      // An Angular eslintrc workspace has the scoped packages installed; the
      // umbrella is what the flat/angular preset needs and what is missing.
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...(json.devDependencies ?? {}),
          '@angular-eslint/eslint-plugin': '^21.5.0',
        };
        return json;
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:@nx/angular'];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toContain('flat/angular');
      // Pinned to the installed @angular-eslint major.
      expect(
        readJson(tree, 'package.json').devDependencies['angular-eslint']
      ).toEqual('^21.0.0');
    });

    it('falls back to the latest angular-eslint major when no @angular-eslint packages are installed', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:@nx/angular'];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toContain('flat/angular');
      expect(
        readJson(tree, 'package.json').devDependencies['angular-eslint']
      ).toEqual('^22.0.0');
    });

    it('remaps angular-eslint v22 removed configs the converter carried over as FlatCompat shims', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...(json.devDependencies ?? {}),
          '@angular-eslint/eslint-plugin': '^22.0.0',
        };
        return json;
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:@angular-eslint/recommended'];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      const content = tree.read('eslint.config.cjs', 'utf-8');
      expect(content).toContain('angular.configs.tsRecommended');
      expect(content).toContain("require('angular-eslint')");
      expect(content).not.toContain(
        "compat.extends('plugin:@angular-eslint/recommended')"
      );
      expect(
        readJson(tree, 'package.json').devDependencies['angular-eslint']
      ).toEqual('^22.0.0');
    });

    it('leaves the converter output untouched below angular-eslint v22', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...(json.devDependencies ?? {}),
          '@angular-eslint/eslint-plugin': '^21.0.0',
        };
        return json;
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:@angular-eslint/recommended'];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      const content = tree.read('eslint.config.cjs', 'utf-8');
      expect(content).toContain(
        "compat.extends('plugin:@angular-eslint/recommended')"
      );
      expect(content).not.toContain('angular.configs.tsRecommended');
    });

    it('reconciles the process-inline-templates shim the converter emits for a standard Angular override', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...(json.devDependencies ?? {}),
          '@angular-eslint/eslint-plugin': '^22.0.0',
        };
        return json;
      });
      // The standard nx Angular `*.ts` override: the converter lifts
      // plugin:@nx/angular to flat/angular and wraps process-inline-templates in
      // a `compat.config({extends}).map(...)` shim, which fails to load on v22.
      updateJson(tree, '.eslintrc.json', (json) => {
        json.overrides = [
          {
            files: ['*.ts'],
            extends: [
              'plugin:@nx/angular',
              'plugin:@angular-eslint/template/process-inline-templates',
            ],
            rules: {
              '@angular-eslint/directive-selector': [
                'error',
                { type: 'attribute' },
              ],
              '@angular-eslint/no-conflicting-lifecycle': 'error',
            },
          },
        ];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      const content = tree.read('eslint.config.cjs', 'utf-8');
      // The shim and the removed rule are gone; the override's own rule survives.
      expect(content).not.toContain('process-inline-templates');
      expect(content).not.toContain('no-conflicting-lifecycle');
      expect(content).not.toContain('compat.config');
      expect(content).not.toContain('FlatCompat');
      expect(content).toContain('flat/angular');
      expect(content).toContain('@angular-eslint/directive-selector');
      // flat/angular already applies the processor, so no processor block is
      // re-emitted and no angular-eslint import is introduced.
      expect(content).not.toContain(
        'processor: angular.processInlineTemplates'
      );
      expect(content).not.toContain("from 'angular-eslint'");
    });

    it('should add global eslintignores', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
      });
      tree.write('.eslintignore', 'ignore/me');
      await convertToFlatConfigGenerator(tree, options);

      const config = tree.read('eslint.config.cjs', 'utf-8');
      expect(config).toContain('ignore/me');
      expect(config).toMatchSnapshot();
      expect(tree.exists('.eslintignore')).toBeFalsy();
    });

    it('should handle custom eslintignores', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      tree.write('another-folder/.myeslintignore', 'ignore/me');
      updateJson(tree, 'libs/test-lib/project.json', (json) => {
        json.targets ??= {};
        json.targets.lint ??= { executor: '@nx/eslint:lint', options: {} };
        json.targets.lint.options = json.targets.lint.options || {};
        json.targets.lint.options.ignorePath = 'another-folder/.myeslintignore';
        return json;
      });
      tree.write('libs/test-lib/.eslintignore', 'ignore/me/as/well');

      await convertToFlatConfigGenerator(tree, options);

      expect(
        tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('another-folder/.myeslintignore')).toBeFalsy();
      expect(tree.exists('libs/test-lib/.eslintignore')).toBeFalsy();

      expect(
        readJson(tree, 'libs/test-lib/project.json').targets.lint.options
          .ignorePath
      ).toBeUndefined();
    });

    it('should add settings', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.settings = {
          sharedData: 'Hello',
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add env configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.env = {
          browser: true,
          node: true,
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add global configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.globals = {
          myCustomGlobal: 'readonly',
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add global and env configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.globals = {
          myCustomGlobal: 'readonly',
        };
        json.env = {
          browser: true,
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add plugins', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.plugins = [
          'eslint-plugin-import',
          'single-name',
          '@scope/with-name',
          '@just-scope',
        ];
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add parser', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.parser = '@typescript-eslint/parser';
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add linter options', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.noInlineConfig = true;
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toMatchInlineSnapshot(`
        "const nx = require('@nx/eslint-plugin');

        module.exports = [
          ...nx.configs['flat/base'],
          {
            linterOptions: {
              noInlineConfig: true,
            },
          },
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            rules: {
              '@nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    {
                      sourceTag: '*',
                      onlyDependOnLibsWithTags: ['*'],
                    },
                  ],
                },
              ],
            },
          },
          ...nx.configs['flat/typescript'],
          ...nx.configs['flat/javascript'],
        ];
        "
      `);
    });

    it('should convert project if target is defined via plugin as string', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.targetDefaults;
        json.plugins = ['@nx/eslint/plugin'];
        return json;
      });
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          delete json.targets.lint;
          return json;
        }
      );

      expect(tree.exists('eslint.config.cjs')).toBeFalsy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeFalsy();
      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
    });

    it('should convert project if target is defined via plugin as object', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.targetDefaults;
        json.plugins = [
          {
            plugin: '@nx/eslint/plugin',
            options: {
              targetName: 'lint',
            },
          },
        ];
        return json;
      });
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          delete json.targets.lint;
          return json;
        }
      );

      expect(tree.exists('eslint.config.cjs')).toBeFalsy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeFalsy();
      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
    });

    it('should convert project if target is defined via a name-keyed targetDefault', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        json.targetDefaults = {
          lint: {
            executor: '@nx/eslint:lint',
            inputs: ['default'],
          },
        };
        return json;
      });
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          json.targets.lint = {
            options: json.targets.lint?.options ?? {},
          };
          return json;
        }
      );

      expect(tree.exists('eslint.config.cjs')).toBeFalsy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeFalsy();
      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeTruthy();
    });

    it('should warn and skip project with eslint config but no lint target', async () => {
      addProjectConfiguration(tree, 'no-lint-lib', {
        root: 'libs/no-lint-lib',
        targets: {},
      });
      tree.write(
        'libs/no-lint-lib/.eslintrc.json',
        JSON.stringify({ extends: ['../../.eslintrc.json'] })
      );
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.plugins;
        return json;
      });

      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });

      updateJson(tree, 'nx.json', (json) => {
        delete json.plugins;
        return json;
      });
      updateJson(tree, 'libs/test-lib/project.json', (json) => {
        json.targets ??= {};
        json.targets.lint = { executor: '@nx/eslint:lint' };
        return json;
      });

      const warnSpy = vi.spyOn(logger, 'warn');
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('libs/no-lint-lib/.eslintrc.json')).toBeTruthy();
      expect(tree.exists('libs/no-lint-lib/eslint.config.cjs')).toBeFalsy();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Skipping "no-lint-lib"')
      );
      warnSpy.mockRestore();
    });

    it('should handle parser options even if parser is extended', async () => {
      addProjectConfiguration(tree, 'dx-assets-ui', {
        root: 'apps/dx-assets-ui',
        targets: {},
      });
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',

        project: 'dx-assets-ui',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'apps/dx-assets-ui/.eslintrc.json', () => {
        return {
          extends: ['../../.eslintrc.json'],
          ignorePatterns: ['!**/*', '__fixtures__/**/*'],
          overrides: [
            {
              files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
              parserOptions: {
                project: ['apps/dx-assets-ui/tsconfig.*?.json'],
              },
              rules: {},
            },
            {
              files: ['*.ts', '*.tsx'],
              rules: {},
            },
            {
              files: ['*.js', '*.jsx'],
              rules: {},
            },
          ],
        };
      });

      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('apps/dx-assets-ui/eslint.config.cjs')).toBeTruthy();
      expect(tree.exists('eslint.config.cjs')).toBeTruthy();
      expect(tree.read('apps/dx-assets-ui/eslint.config.cjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "const baseConfig = require('../../eslint.config.cjs');

        module.exports = [
          ...baseConfig,
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
            languageOptions: {
              parserOptions: {
                project: ['apps/dx-assets-ui/tsconfig.*?.json'],
              },
            },
          },
          {
            files: ['**/*.ts', '**/*.tsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
          {
            ignores: ['__fixtures__/**/*'],
          },
        ];
        "
      `);
    });
  });

  describe('MJS', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'mjs',
    };

    it('should update dependencies', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      await convertToFlatConfigGenerator(tree, options);

      // The @nx/* versions come from nxVersion, which self-resolves to
      // packages/eslint/package.json - a file `nx-release --local` rewrites in CI.
      expect(readJson(tree, 'package.json')).toEqual({
        name: '@proj/source',
        dependencies: {},
        devDependencies: {
          '@nx/eslint': expect.anything(),
          '@nx/eslint-plugin': expect.anything(),
          '@typescript-eslint/eslint-plugin': '^8.58.0',
          '@typescript-eslint/parser': '^8.58.0',
          eslint: '^9.8.0',
          'eslint-config-prettier': '^10.0.0',
          'typescript-eslint': '^8.58.0',
        },
      });
    });

    it('should convert json successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.mjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.mjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.mjs'
      );
    });

    it('should convert yaml successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        eslintFilePatterns: ['**/*.ts'],
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      const yamlContent = dump(readJson(tree, 'libs/test-lib/.eslintrc.json'));
      tree.delete('libs/test-lib/.eslintrc.json');
      tree.write('libs/test-lib/.eslintrc.yaml', yamlContent);

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.mjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.mjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.mjs'
      );
    });

    it('should convert yml successfully', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        eslintFilePatterns: ['**/*.ts'],
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      const yamlContent = dump(readJson(tree, 'libs/test-lib/.eslintrc.json'));
      tree.delete('libs/test-lib/.eslintrc.json');
      tree.write('libs/test-lib/.eslintrc.yml', yamlContent);

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeTruthy();
      expect(
        tree.read('libs/test-lib/eslint.config.mjs', 'utf-8')
      ).toMatchSnapshot();
      // check nx.json changes
      const nxJson = readJson(tree, 'nx.json');
      expect(getLintInputs(nxJson)).toContain(
        '{workspaceRoot}/eslint.config.mjs'
      );
      expect(nxJson.namedInputs.production).toContain(
        '!{projectRoot}/eslint.config.mjs'
      );
    });

    it('should add plugin extends', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:storybook/recommended'];
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "import { FlatCompat } from '@eslint/eslintrc';
        import { dirname } from 'path';
        import { fileURLToPath } from 'url';
        import js from '@eslint/js';
        import nx from '@nx/eslint-plugin';

        const compat = new FlatCompat({
          baseDirectory: dirname(fileURLToPath(import.meta.url)),
          recommendedConfig: js.configs.recommended,
        });

        const eslintConfig = [
          ...compat.extends('plugin:storybook/recommended'),
          ...nx.configs['flat/base'],
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            rules: {
              '@nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    {
                      sourceTag: '*',
                      onlyDependOnLibsWithTags: ['*'],
                    },
                  ],
                },
              ],
            },
          },
          ...nx.configs['flat/typescript'],
          ...nx.configs['flat/javascript'],
        ];

        export default eslintConfig;
        "
      `);
      expect(tree.read('libs/test-lib/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from '../../eslint.config.mjs';

        const eslintConfig = [
          ...baseConfig,
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.ts', '**/*.tsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
        ];

        export default eslintConfig;
        "
      `);
      expect(
        readJson(tree, 'package.json').devDependencies['@eslint/eslintrc']
      ).toEqual(eslintrcVersion);
    });

    it('should add global eslintignores', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
      });
      tree.write('.eslintignore', 'ignore/me');
      await convertToFlatConfigGenerator(tree, options);

      const config = tree.read('eslint.config.mjs', 'utf-8');
      expect(config).toContain('ignore/me');
      expect(config).toMatchSnapshot();
      expect(tree.exists('.eslintignore')).toBeFalsy();
    });

    it('should handle custom eslintignores', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      tree.write('another-folder/.myeslintignore', 'ignore/me');
      updateJson(tree, 'libs/test-lib/project.json', (json) => {
        json.targets ??= {};
        json.targets.lint ??= { executor: '@nx/eslint:lint', options: {} };
        json.targets.lint.options = json.targets.lint.options || {};
        json.targets.lint.options.ignorePath = 'another-folder/.myeslintignore';
        return json;
      });
      tree.write('libs/test-lib/.eslintignore', 'ignore/me/as/well');

      await convertToFlatConfigGenerator(tree, options);

      expect(
        tree.read('libs/test-lib/eslint.config.mjs', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('another-folder/.myeslintignore')).toBeFalsy();
      expect(tree.exists('libs/test-lib/.eslintignore')).toBeFalsy();

      expect(
        readJson(tree, 'libs/test-lib/project.json').targets.lint.options
          .ignorePath
      ).toBeUndefined();
    });

    it('should add settings', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.settings = {
          sharedData: 'Hello',
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add env configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.env = {
          browser: true,
          node: true,
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add global configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.globals = {
          myCustomGlobal: 'readonly',
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add global and env configuration', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.globals = {
          myCustomGlobal: 'readonly',
        };
        json.env = {
          browser: true,
        };
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add plugins', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.plugins = [
          'eslint-plugin-import',
          'single-name',
          '@scope/with-name',
          '@just-scope',
        ];
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add parser', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.parser = '@typescript-eslint/parser';
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchSnapshot();
    });

    it('should add linter options', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, '.eslintrc.json', (json) => {
        json.noInlineConfig = true;
        return json;
      });
      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
        "import nx from '@nx/eslint-plugin';

        const eslintConfig = [
          ...nx.configs['flat/base'],
          {
            linterOptions: {
              noInlineConfig: true,
            },
          },
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            rules: {
              '@nx/enforce-module-boundaries': [
                'error',
                {
                  enforceBuildableLibDependency: true,
                  allow: [],
                  depConstraints: [
                    {
                      sourceTag: '*',
                      onlyDependOnLibsWithTags: ['*'],
                    },
                  ],
                },
              ],
            },
          },
          ...nx.configs['flat/typescript'],
          ...nx.configs['flat/javascript'],
        ];

        export default eslintConfig;
        "
      `);
    });

    it('should convert project if target is defined via plugin as string', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.targetDefaults;
        json.plugins = ['@nx/eslint/plugin'];
        return json;
      });
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          delete json.targets.lint;
          return json;
        }
      );

      expect(tree.exists('eslint.config.mjs')).toBeFalsy();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeFalsy();
      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeTruthy();
    });

    it('should convert project if target is defined via plugin as object', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.targetDefaults;
        json.plugins = [
          {
            plugin: '@nx/eslint/plugin',
            options: {
              targetName: 'lint',
            },
          },
        ];
        return json;
      });
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          delete json.targets.lint;
          return json;
        }
      );

      expect(tree.exists('eslint.config.mjs')).toBeFalsy();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeFalsy();
      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.exists('libs/test-lib/eslint.config.mjs')).toBeTruthy();
    });

    it('should handle parser options even if parser is extended', async () => {
      addProjectConfiguration(tree, 'dx-assets-ui', {
        root: 'apps/dx-assets-ui',
        targets: {},
      });
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',

        project: 'dx-assets-ui',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, 'apps/dx-assets-ui/.eslintrc.json', () => {
        return {
          extends: ['../../.eslintrc.json'],
          ignorePatterns: ['!**/*', '__fixtures__/**/*'],
          overrides: [
            {
              files: ['*.ts', '*.tsx', '*.js', '*.jsx'],
              parserOptions: {
                project: ['apps/dx-assets-ui/tsconfig.*?.json'],
              },
              rules: {},
            },
            {
              files: ['*.ts', '*.tsx'],
              rules: {},
            },
            {
              files: ['*.js', '*.jsx'],
              rules: {},
            },
          ],
        };
      });

      await convertToFlatConfigGenerator(tree, options);
      expect(tree.exists('apps/dx-assets-ui/eslint.config.mjs')).toBeTruthy();
      expect(tree.exists('eslint.config.mjs')).toBeTruthy();
      expect(tree.read('apps/dx-assets-ui/eslint.config.mjs', 'utf-8'))
        .toMatchInlineSnapshot(`
        "import baseConfig from '../../eslint.config.mjs';

        const eslintConfig = [
          ...baseConfig,
          {
            files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
            languageOptions: {
              parserOptions: {
                project: ['apps/dx-assets-ui/tsconfig.*?.json'],
              },
            },
          },
          {
            files: ['**/*.ts', '**/*.tsx'],
            // Override or add rules here
            rules: {},
          },
          {
            files: ['**/*.js', '**/*.jsx'],
            // Override or add rules here
            rules: {},
          },
          {
            ignores: ['__fixtures__/**/*'],
          },
        ];

        export default eslintConfig;
        "
      `);
    });

    it('should rewrite stale eslintrc/eslintignore references in nx.json and project.json inputs', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'mjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        json.targetDefaults = {
          ...json.targetDefaults,
          lint: {
            inputs: [
              'default',
              '{workspaceRoot}/.eslintrc.json',
              '{workspaceRoot}/.eslintignore',
            ],
          },
          build: {
            inputs: [
              'production',
              '^production',
              '{projectRoot}/.eslintrc.json',
              { runtime: 'node --version' },
            ],
          },
        };
        json.namedInputs = {
          ...json.namedInputs,
          production: [
            'default',
            '!{projectRoot}/.eslintrc.json',
            '!{projectRoot}/.eslintignore',
          ],
          customNamedInput: [
            '{projectRoot}/.eslintrc.base.json',
            '{projectRoot}/src/**/*',
          ],
        };
        return json;
      });
      updateProjectConfiguration(tree, 'test-lib', {
        ...readProjectConfiguration(tree, 'test-lib'),
        root: 'libs/test-lib',
        targets: {
          lint: {
            executor: '@nx/eslint:lint',
            inputs: [
              'default',
              '{projectRoot}/.eslintrc.json',
              '{projectRoot}/.eslintignore',
            ],
            options: {},
          },
        },
        namedInputs: {
          projectNamed: [
            '{projectRoot}/.eslintrc.json',
            '{projectRoot}/src/**/*',
          ],
        },
      });

      await convertToFlatConfigGenerator(tree, {
        skipFormat: false,
        eslintConfigFormat: 'mjs',
      });

      const nxJson = readJson(tree, 'nx.json');
      // legacy refs rewritten and dedup'd against the newly ensured entry
      expect(nxJson.targetDefaults.lint.inputs).toEqual([
        'default',
        '{workspaceRoot}/eslint.config.mjs',
      ]);
      // non-lint targets: legacy refs still rewritten, non-string inputs preserved
      expect(nxJson.targetDefaults.build.inputs).toEqual([
        'production',
        '^production',
        '{projectRoot}/eslint.config.mjs',
        { runtime: 'node --version' },
      ]);
      expect(nxJson.namedInputs.production).toEqual([
        'default',
        '!{projectRoot}/eslint.config.mjs',
      ]);
      expect(nxJson.namedInputs.customNamedInput).toEqual([
        '{projectRoot}/eslint.base.config.mjs',
        '{projectRoot}/src/**/*',
      ]);

      const projectJson = readProjectConfiguration(tree, 'test-lib');
      expect(projectJson.targets.lint.inputs).toEqual([
        'default',
        '{projectRoot}/eslint.config.mjs',
      ]);
      expect(projectJson.namedInputs.projectNamed).toEqual([
        '{projectRoot}/eslint.config.mjs',
        '{projectRoot}/src/**/*',
      ]);
    });
  });

  describe('keepExistingVersions', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'cjs',
    };

    it('should keep existing ESLint pins and only add new packages when keepExistingVersions is true', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      // A third-party `extends` forces the FlatCompat shim (`@eslint/eslintrc`)
      // and `js.configs.recommended` (`@eslint/js`), so the generator has new
      // packages to add on top of the existing stack.
      updateJson(tree, '.eslintrc.json', (json) => {
        json.extends = ['plugin:storybook/recommended'];
        return json;
      });
      // Pre-pin an already-supported (v9) stack that differs from the latest so
      // preservation is observable.
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          eslint: '^9.5.0',
          'typescript-eslint': '^8.20.0',
        };
        return json;
      });

      await convertToFlatConfigGenerator(tree, {
        ...options,
        keepExistingVersions: true,
      });

      const { devDependencies } = readJson(tree, 'package.json');
      // Existing pins are preserved (not bumped to the latest supported stack).
      expect(devDependencies.eslint).toBe('^9.5.0');
      expect(devDependencies['typescript-eslint']).toBe('^8.20.0');
      // Newly required flat-config packages are still added.
      expect(devDependencies['@eslint/eslintrc']).toBe(eslintrcVersion);
      expect(devDependencies['@eslint/js']).toBe('^9.8.0');
    });

    it('should overwrite existing ESLint pins by default', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'package.json', (json) => {
        json.devDependencies = {
          ...json.devDependencies,
          eslint: '^9.5.0',
        };
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      const { devDependencies } = readJson(tree, 'package.json');
      expect(devDependencies.eslint).toBe('^9.8.0');
    });
  });

  describe('already on flat config', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'mjs',
    };

    it('should be a no-op when a root flat config already exists', async () => {
      tree.write('eslint.config.mjs', 'module.exports = [];');
      const packageJsonBefore = tree.read('package.json', 'utf-8');

      const result = await convertToFlatConfigGenerator(tree, options);

      expect(result).toBeUndefined();
      // Nothing was converted: package.json untouched and no cjs config emitted.
      expect(tree.read('package.json', 'utf-8')).toEqual(packageJsonBefore);
      expect(tree.exists('eslint.config.cjs')).toBeFalsy();
    });
  });

  describe('JavaScript-based project config', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'cjs',
    };

    it.each(['.eslintrc.js', '.eslintrc.cjs'])(
      'should convert a project whose %s is built from literals',
      async (jsConfig) => {
        await lintProjectGenerator(tree, {
          skipFormat: false,
          linter: 'eslint',
          project: 'test-lib',
          enableTypedLinting: false,
          eslintConfigFormat: 'cjs',
        });
        // Swap the project's JSON config for a statically readable JS one.
        tree.delete('libs/test-lib/.eslintrc.json');
        tree.write(
          `libs/test-lib/${jsConfig}`,
          `module.exports = { rules: { 'no-console': 'error' } };`
        );

        const warnSpy = vi.spyOn(logger, 'warn');
        await convertToFlatConfigGenerator(tree, options);

        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Skipping "test-lib"')
        );
        expect(tree.exists(`libs/test-lib/${jsConfig}`)).toBeFalsy();
        expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')).toContain(
          `'no-console': 'error'`
        );
        warnSpy.mockRestore();
      }
    );

    it.each(['.eslintrc.js', '.eslintrc.cjs'])(
      'should warn and skip a project whose %s cannot be read statically',
      async (jsConfig) => {
        await lintProjectGenerator(tree, {
          skipFormat: false,
          linter: 'eslint',
          project: 'test-lib',
          enableTypedLinting: false,
          eslintConfigFormat: 'cjs',
        });
        // Swap the project's JSON config for a JS one that computes its values.
        tree.delete('libs/test-lib/.eslintrc.json');
        tree.write(
          `libs/test-lib/${jsConfig}`,
          `module.exports = { rules: require('./rules') };`
        );

        const warnSpy = vi.spyOn(logger, 'warn');
        await convertToFlatConfigGenerator(tree, options);

        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Skipping "test-lib"')
        );
        // The JS config is left in place, not converted.
        expect(tree.exists(`libs/test-lib/${jsConfig}`)).toBeTruthy();
        expect(tree.exists('libs/test-lib/eslint.config.cjs')).toBeFalsy();
        warnSpy.mockRestore();
      }
    );

    it('should convert a root JavaScript-based config built from literals', async () => {
      tree.write(
        '.eslintrc.js',
        `module.exports = { root: true, rules: { 'no-console': 'error' } };`
      );

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('.eslintrc.js')).toBeFalsy();
      expect(tree.read('eslint.config.cjs', 'utf-8')).toContain(
        `'no-console': 'error'`
      );
    });

    it.each([
      [
        '.eslintrc.js',
        '../../.eslintrc.js',
        `module.exports = { root: true, rules: { 'no-console': 'error' } };`,
      ],
      [
        '.eslintrc.yaml',
        '../../.eslintrc.yaml',
        'root: true\nrules:\n  no-console: error\n',
      ],
      [
        '.eslintrc.json',
        '../../.eslintrc',
        '{ "root": true, "rules": { "no-console": "error" } }',
      ],
    ])(
      'should import the converted root config %s in projects that extend %s',
      async (rootConfig, extendsPath, content) => {
        tree.write(rootConfig, content);
        await lintProjectGenerator(tree, {
          skipFormat: false,
          linter: 'eslint',
          project: 'test-lib',
          enableTypedLinting: false,
          eslintConfigFormat: 'cjs',
        });
        updateJson(tree, 'libs/test-lib/.eslintrc.json', (json) => {
          json.extends = [extendsPath];
          return json;
        });

        await convertToFlatConfigGenerator(tree, options);

        const projectConfig = tree.read(
          'libs/test-lib/eslint.config.cjs',
          'utf-8'
        );
        expect(projectConfig).toContain(
          `const baseConfig = require('../../eslint.config.cjs');`
        );
        expect(projectConfig).not.toContain('.eslintrc');
      }
    );

    it('should keep FlatCompat for an extends of a JavaScript-based config it cannot read statically', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      addProjectConfiguration(tree, 'shared-config', {
        root: 'libs/shared-config',
      });
      tree.write(
        'libs/shared-config/.eslintrc.js',
        `module.exports = { rules: require('./rules') };`
      );
      updateJson(tree, 'libs/test-lib/.eslintrc.json', (json) => {
        json.extends = ['../shared-config/.eslintrc.js'];
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('libs/shared-config/.eslintrc.js')).toBeTruthy();
      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')).toContain(
        `compat.extends('../shared-config/.eslintrc.js')`
      );
    });

    it.each([
      [
        'a JavaScript config outside any project',
        {
          'tools/.eslintrc.cjs': `module.exports = { rules: { 'no-console': 'error' } };`,
        },
        '../../tools/.eslintrc.cjs',
      ],
      [
        'a YAML config outside any project',
        { 'tools/.eslintrc.yaml': 'rules:\n  no-console: error\n' },
        '../../tools/.eslintrc.yaml',
      ],
      [
        'a JSON config outside any project',
        { 'tools/.eslintrc.json': '{ "rules": { "no-console": "error" } }' },
        '../../tools/.eslintrc.json',
      ],
      [
        "a project's config that loses to a higher-precedence one",
        {
          'libs/shared-config/.eslintrc.yaml': 'rules:\n  no-console: error\n',
          'libs/shared-config/.eslintrc.json':
            '{ "rules": { "no-debugger": "error" } }',
        },
        '../shared-config/.eslintrc.json',
      ],
    ])(
      'should keep FlatCompat for an extends of %s, which the conversion leaves in place',
      async (_, files: Record<string, string>, extendsPath) => {
        await lintProjectGenerator(tree, {
          skipFormat: false,
          linter: 'eslint',
          project: 'test-lib',
          enableTypedLinting: false,
          eslintConfigFormat: 'cjs',
        });
        addProjectConfiguration(tree, 'shared-config', {
          root: 'libs/shared-config',
          targets: { lint: { command: 'eslint .' } },
        });
        for (const [file, content] of Object.entries(files)) {
          tree.write(file, content);
        }
        updateJson(tree, 'libs/test-lib/.eslintrc.json', (json) => {
          json.extends = [extendsPath];
          return json;
        });

        await convertToFlatConfigGenerator(tree, options);

        expect(
          tree.exists(joinPathFragments('libs/test-lib', extendsPath))
        ).toBe(true);
        expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')).toContain(
          `compat.extends('${extendsPath}')`
        );
      }
    );

    it('should throw with the reason when the root JavaScript-based config cannot be read statically', async () => {
      tree.write(
        '.eslintrc.js',
        `module.exports = { rules: require('./rules') };`
      );

      await expect(convertToFlatConfigGenerator(tree, options)).rejects.toThrow(
        `Cannot convert ".eslintrc.js" automatically because "rules" is not a literal value (require('./rules')).`
      );
      expect(tree.exists('.eslintrc.js')).toBeTruthy();
    });

    it.each(ESLINT_FLAT_CONFIG_FILENAMES)(
      'should silently skip a project already on a flat config: %s',
      async (filename) => {
        await lintProjectGenerator(tree, {
          skipFormat: false,
          linter: 'eslint',
          project: 'test-lib',
          enableTypedLinting: false,
          eslintConfigFormat: 'cjs',
        });
        tree.delete('libs/test-lib/.eslintrc.json');
        tree.write(`libs/test-lib/${filename}`, 'export default [];');

        const warnSpy = vi.spyOn(logger, 'warn');
        await convertToFlatConfigGenerator(tree, options);

        expect(warnSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('Skipping')
        );
        warnSpy.mockRestore();
      }
    );

    it('should report an eslintrc that parses to nothing instead of skipping it silently', async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      tree.delete('libs/test-lib/.eslintrc.json');
      // A comment-only YAML document loads to null, so there is no config to read.
      tree.write('libs/test-lib/.eslintrc.yaml', '# nothing here\n');
      tree.write('libs/test-lib/.eslintignore', 'dist\n');

      const warnSpy = vi.spyOn(logger, 'warn');
      await convertToFlatConfigGenerator(tree, options);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Skipping "libs/test-lib/.eslintrc.yaml": it does not hold an ESLint configuration'
        )
      );
      expect(tree.exists('libs/test-lib/.eslintrc.yaml')).toBe(true);
      // The eslintrc is still there, and it is the only thing that reads the
      // ignore file, so the ignore file has to stay with it.
      expect(tree.exists('libs/test-lib/.eslintignore')).toBe(true);
      warnSpy.mockRestore();
    });

    it('should refuse to convert when the root eslintrc parses to nothing', async () => {
      tree.delete('.eslintrc.json');
      tree.write('.eslintrc.yaml', '# nothing here\n');

      await expect(convertToFlatConfigGenerator(tree, options)).rejects.toThrow(
        'Cannot convert ".eslintrc.yaml": it does not hold an ESLint configuration'
      );
    });
  });

  // Converting `@nx/eslint:lint` targets to `@nx/eslint/plugin` leaves the
  // executor's eslintrc-only options on the target as ESLint CLI flags.
  describe('eslintrc-only lint target options', () => {
    const options: ConvertToFlatConfigGeneratorSchema = {
      skipFormat: false,
      eslintConfigFormat: 'cjs',
    };

    beforeEach(async () => {
      await lintProjectGenerator(tree, {
        skipFormat: false,
        linter: 'eslint',
        project: 'test-lib',
        enableTypedLinting: false,
        eslintConfigFormat: 'cjs',
      });
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        delete json.targetDefaults;
        json.plugins = ['@nx/eslint/plugin'];
        return json;
      });
    });

    function setTestLibTargets(targets: ProjectConfiguration['targets']) {
      updateJson(
        tree,
        'libs/test-lib/project.json',
        (json: ProjectConfiguration) => {
          json.targets = targets;
          return json;
        }
      );
    }

    it('should fold an ignore-path into the project config and remove the options flat config rejects', async () => {
      tree.write('libs/test-lib/custom.eslintignore', 'generated/**');
      setTestLibTargets({
        lint: {
          options: {
            'ignore-path': 'custom.eslintignore',
            'no-eslintrc': true,
            rulesdir: ['tools/eslint-rules'],
            'resolve-plugins-relative-to': 'tools',
            'report-unused-disable-directives': 'error',
          },
          configurations: { ci: { 'no-eslintrc': true } },
        },
      });
      // Lints with the root config, so it has no eslintrc of its own.
      addProjectConfiguration(tree, 'no-config-lib', {
        root: 'libs/no-config-lib',
        targets: { lint: { options: { 'no-eslintrc': true } } },
      });
      const warnSpy = vi.spyOn(logger, 'warn');

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')).toContain(
        'generated/**'
      );
      expect(tree.exists('libs/test-lib/custom.eslintignore')).toBe(false);
      expect(readProjectConfiguration(tree, 'test-lib').targets.lint).toEqual({
        options: {
          rulesdir: ['tools/eslint-rules'],
          'resolve-plugins-relative-to': 'tools',
          'report-unused-disable-directives': 'error',
        },
        configurations: { ci: {} },
      });
      expect(
        readProjectConfiguration(tree, 'no-config-lib').targets.lint.options
      ).toEqual({});
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'project "test-lib" target "lint": resolve-plugins-relative-to, rulesdir'
        )
      );
      warnSpy.mockRestore();
    });

    it('should fold an ignore-path relative to the workspace root under a custom plugin target name', async () => {
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        json.plugins = [
          {
            plugin: '@nx/eslint/plugin',
            options: { targetName: 'eslint-lint' },
          },
        ];
        return json;
      });
      // The executor ran from the workspace root, and the conversion copied
      // its path as is.
      tree.write('tools/lint.eslintignore', 'fixtures/**');
      setTestLibTargets({
        'eslint-lint': {
          options: { 'ignore-path': 'tools/lint.eslintignore' },
        },
      });
      addProjectConfiguration(tree, 'other-lib', {
        root: 'libs/other-lib',
        targets: {
          'eslint-lint': {
            configurations: {
              ci: { 'ignore-path': 'tools/lint.eslintignore' },
            },
          },
        },
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('libs/test-lib/eslint.config.cjs', 'utf-8')).toContain(
        'fixtures/**'
      );
      expect(
        readProjectConfiguration(tree, 'test-lib').targets['eslint-lint']
          .options
      ).toEqual({});
      // other-lib still names it.
      expect(tree.exists('tools/lint.eslintignore')).toBe(true);
    });

    it('should fold an ignore-path hoisted to an @nx/eslint/plugin targetDefaults entry into the root config', async () => {
      tree.write('.gitignore', 'generated/**');
      updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
        json.targetDefaults = {
          lint: [
            {
              filter: { plugin: '@nx/eslint/plugin' },
              options: { 'ignore-path': '.gitignore', 'no-eslintrc': true },
            },
            {
              filter: { plugin: '@nx/eslint/plugin', projects: ['test-lib'] },
              options: { 'no-eslintrc': true },
            },
          ],
        };
        return json;
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.read('eslint.config.cjs', 'utf-8')).toContain('generated/**');
      // Git still reads it.
      expect(tree.exists('.gitignore')).toBe(true);
      expect(readJson(tree, 'nx.json').targetDefaults.lint).toEqual([
        { filter: { plugin: '@nx/eslint/plugin' }, options: {} },
        {
          filter: { plugin: '@nx/eslint/plugin', projects: ['test-lib'] },
          options: {},
        },
      ]);
    });

    it('should leave an ignore-path that a configuration replaces for its runs', async () => {
      tree.write('libs/test-lib/base.eslintignore', 'base/**');
      const lint = {
        options: { 'ignore-path': 'base.eslintignore' },
        configurations: { ci: { 'ignore-path': 'ci.eslintignore' } },
      };
      setTestLibTargets({ lint });
      const warnSpy = vi.spyOn(logger, 'warn');

      await convertToFlatConfigGenerator(tree, options);

      expect(readProjectConfiguration(tree, 'test-lib').targets.lint).toEqual(
        lint
      );
      expect(tree.exists('libs/test-lib/base.eslintignore')).toBe(true);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'project "test-lib" target "lint": ignore-path; project "test-lib" target "lint" (configuration "ci"): ignore-path'
        )
      );
      warnSpy.mockRestore();
    });

    const sharedEntry: TargetDefaultArrayEntry = {
      filter: { plugin: '@nx/eslint/plugin' },
      options: { 'ignore-path': 'shared.eslintignore' },
    };
    const narrowerFilter = {
      plugin: '@nx/eslint/plugin',
      projects: ['test-lib'],
    };
    it.each<
      [string, TargetDefaultArrayEntry[], ProjectConfiguration['targets']?]
    >([
      [
        'a project sets its own',
        [sharedEntry],
        { lint: { options: { 'ignore-path': 'own.eslintignore' } } },
      ],
      [
        'a narrower entry sets its own',
        [
          sharedEntry,
          {
            filter: narrowerFilter,
            options: { 'ignore-path': 'own.eslintignore' },
          },
        ],
      ],
      [
        'only a narrower entry sets it',
        [{ filter: narrowerFilter, options: sharedEntry.options }],
      ],
      [
        'a configuration sets its own',
        [
          {
            ...sharedEntry,
            configurations: { ci: { 'ignore-path': 'own.eslintignore' } },
          },
        ],
      ],
    ])(
      'should leave a targetDefaults ignore-path when %s',
      async (_, entries, targets) => {
        tree.write('shared.eslintignore', 'shared/**');
        updateJson(tree, 'nx.json', (json: NxJsonConfiguration) => {
          json.targetDefaults = { lint: entries };
          return json;
        });
        if (targets) {
          setTestLibTargets(targets);
        }

        await convertToFlatConfigGenerator(tree, options);

        expect(tree.read('eslint.config.cjs', 'utf-8')).not.toContain(
          'shared/**'
        );
        expect(tree.exists('shared.eslintignore')).toBe(true);
      }
    );

    it('should leave the options of another tool target that shares the plugin target name', async () => {
      tree.write('libs/test-lib/.stylelintignore', 'dist/**');
      setTestLibTargets({
        lint: {
          command: 'stylelint "**/*.css"',
          options: { 'ignore-path': '.stylelintignore' },
        },
      });

      await convertToFlatConfigGenerator(tree, options);

      expect(tree.exists('libs/test-lib/.stylelintignore')).toBe(true);
      expect(readProjectConfiguration(tree, 'test-lib').targets.lint).toEqual({
        command: 'stylelint "**/*.css"',
        options: { 'ignore-path': '.stylelintignore' },
      });
    });
  });
});
