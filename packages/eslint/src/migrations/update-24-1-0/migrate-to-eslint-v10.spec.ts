import '@nx/devkit/internal-testing-utils/mock-project-graph';

import {
  addProjectConfiguration,
  readJson,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { withPnpm } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// vi.spyOn must target the module the code under test binds (packages/devkit
// imports nx/src/devkit-internals directly); spying on the @nx/devkit/internal
// barrel re-export would not intercept it.
// oxlint-disable-next-line no-restricted-imports
import * as devkitInternals from 'nx/src/devkit-internals';
import { coerce } from 'semver';
import * as ts from 'typescript';

import update, {
  ESLINT_PLUGIN_IMPORT_X_VERSION,
  ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION,
  V9_ONLY_PLUGINS,
} from './migrate-to-eslint-v10';

describe('migrate-to-eslint-v10 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    // The peer scan resolves manifests from the real workspace, so stub them:
    // only eslint resolves, as the install that runs before migrations leaves it.
    mockEslintPeerRanges({}, /* installedEslintVersion */ '10.0.0');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setDevDependencies(deps: Record<string, string>): void {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, ...deps };
      return json;
    });
  }

  function registerEslintPlugin(): void {
    updateJson(tree, 'nx.json', (json) => {
      json.plugins = ['@nx/eslint/plugin'];
      return json;
    });
  }

  function mockEslintPeerRanges(
    peers: Record<string, string>,
    installedEslintVersion?: string
  ): void {
    // node_modules holds what was installed before the migration ran, so the
    // versions are snapshotted here rather than read back from the tree the
    // migration has since rewritten.
    const { dependencies = {}, devDependencies = {} } = readJson(
      tree,
      'package.json'
    );
    const installedVersions: Record<string, string> = {
      ...dependencies,
      ...devDependencies,
    };
    vi.spyOn(devkitInternals, 'readModulePackageJson').mockImplementation(
      (name: string) => {
        if (name === 'eslint') {
          if (!installedEslintVersion) {
            throw new Error(`Cannot find module '${name}'`);
          }
          return {
            path: 'node_modules/eslint/package.json',
            packageJson: { name, version: installedEslintVersion },
          };
        }
        if (!(name in peers)) {
          throw new Error(`Cannot find module '${name}'`);
        }
        return {
          path: `node_modules/${name}/package.json`,
          packageJson: {
            name,
            version: coerce(installedVersions[name])?.version ?? '1.0.0',
            peerDependencies: { eslint: peers[name] },
          },
        };
      }
    );
  }

  it('should be a no-op on a flat-config workspace with no v9-only plugins', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    const before = readJson(tree, 'package.json');

    const result = await update(tree);

    expect(readJson(tree, 'package.json')).toEqual(before);
    expect(tree.read('eslint.config.mjs', 'utf-8').trim()).toBe(
      'export default [];'
    );
    expect(result).toEqual({ nextSteps: [], agentContext: [] });
  });

  it('should convert a JSON eslintrc workspace', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, rules: { 'no-console': 'error' } })
    );

    const result = await update(tree);

    expect(tree.exists('eslint.config.mjs')).toBe(true);
    expect(tree.exists('.eslintrc.json')).toBe(false);
    expect(result.agentContext).toEqual([]);
  });

  it('should convert a JavaScript-based eslintrc built from literals', async () => {
    tree.write(
      '.eslintrc.js',
      `module.exports = {
        root: true,
        rules: { 'no-console': 'error' },
      };`
    );

    const result = await update(tree);

    expect(tree.exists('.eslintrc.js')).toBe(false);
    expect(tree.read('eslint.config.mjs', 'utf-8')).toContain(
      "'no-console': 'error'"
    );
    expect(result.agentContext).toEqual([]);
  });

  it('should hand off to the prompt even when it found nothing to report', async () => {
    tree.write('eslint.config.mjs', 'export default [];');

    const result = await update(tree);

    // The pass never runs lint, so it cannot know the workspace is done.
    expect(result).not.toHaveProperty('skipAgentic');
  });

  it('should convert a project JavaScript-based eslintrc that extends the root', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true, rules: {} }));
    registerEslintPlugin();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    tree.write(
      'apps/app1/.eslintrc.js',
      `module.exports = {
        extends: ['../../.eslintrc.json'],
        overrides: [
          { files: ['*.ts'], rules: { '@typescript-eslint/no-explicit-any': 'error' } },
        ],
      };`
    );

    await update(tree);

    expect(tree.exists('apps/app1/.eslintrc.js')).toBe(false);
    expect(tree.read('apps/app1/eslint.config.mjs', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import baseConfig from '../../eslint.config.mjs';

      const eslintConfig = [
        ...baseConfig,
        {
          files: ['**/*.ts'],
          rules: {
            '@typescript-eslint/no-explicit-any': 'error',
          },
        },
      ];

      export default eslintConfig;
      "
    `);
  });

  it('should report a JavaScript-based eslintrc it cannot read statically', async () => {
    tree.write(
      '.eslintrc.js',
      `const shared = require('./shared');
      module.exports = { rules: shared.rules };`
    );

    const result = await update(tree);

    // Never guessed at: the file is left in place for the agent.
    expect(tree.exists('.eslintrc.js')).toBe(true);
    expect(tree.exists('eslint.config.mjs')).toBe(false);
    expect(result.agentContext.join('\n')).toContain('.eslintrc.js');
    expect(result.agentContext.join('\n')).toContain(
      'contains code other than a single "module.exports" assignment'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'Convert these JavaScript-based ESLint configs to flat config manually'
    );
  });

  it('should convert through the base config when an unreadable root JavaScript config sits beside it', async () => {
    // The generator picks .eslintrc.base.json over .eslintrc.js, so the
    // unreadable file never reaches it and must not hold the conversion back.
    tree.write('.eslintrc.base.json', JSON.stringify({ rules: {} }));
    registerEslintPlugin();
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    tree.write(
      'apps/app1/.eslintrc.json',
      JSON.stringify({ extends: ['../../.eslintrc.base.json'], rules: {} })
    );
    tree.write(
      '.eslintrc.js',
      `const shared = require('./shared');
      module.exports = { rules: shared.rules };`
    );

    const result = await update(tree);

    expect(tree.exists('eslint.base.config.mjs')).toBe(true);
    expect(tree.exists('apps/app1/eslint.config.mjs')).toBe(true);
    // Left in place, and reported as an eslintrc ESLint v10 stops reading.
    expect(tree.exists('.eslintrc.js')).toBe(true);
    expect(result.nextSteps.join('\n')).toContain(
      'except any a flat config loads that way: .eslintrc.js.'
    );
  });

  it('should report the eslintrc-only options a lint target still passes', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true, rules: {} }));
    registerEslintPlugin();
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: { lint: { options: { rulesdir: ['tools/eslint-rules'] } } },
    });

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'only exist for eslintrc: project "app1" target "lint": rulesdir.'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'since ESLint v10 does not support them: project "app1" target "lint": rulesdir.'
    );
  });

  it('should list an unreadable root config once in a standalone workspace', async () => {
    // The root project is rooted at `.`, so the project scan and the root check
    // both see the same file.
    addProjectConfiguration(tree, 'app1', { root: '.' });
    tree.write(
      '.eslintrc.js',
      `const shared = require('./shared');
      module.exports = { rules: shared.rules };`
    );

    const result = await update(tree);

    const listed = result.nextSteps.join('\n').match(/\.eslintrc\.js/g);
    expect(listed).toHaveLength(1);
  });

  it('should report a project eslintrc the conversion shadowed as no longer applied', async () => {
    tree.write('.eslintrc.json', JSON.stringify({ root: true, rules: {} }));
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    // Not a config the generator converts: it is not at a project root.
    tree.write(
      'apps/app1/nested/.eslintrc.json',
      JSON.stringify({ rules: {} })
    );

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'ESLint v10 removed the eslintrc format'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'ESLint v10 no longer reads eslintrc files unless a flat config loads them through FlatCompat. Fold these into flat config and delete them, except any a flat config loads that way: apps/app1/nested/.eslintrc.json.'
    );
  });

  it('should report a project eslintrc under an existing flat root as already dormant', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    tree.write('apps/app1/.eslintrc.json', JSON.stringify({ rules: {} }));

    const result = await update(tree);

    // The flat config at the root already won over this file on ESLint v9, so
    // folding it in turns rules back on rather than restoring lost enforcement.
    expect(result.agentContext.join('\n')).toContain(
      'These eslintrc files are still in the workspace: apps/app1/.eslintrc.json. Unless lint ran with ESLINT_USE_FLAT_CONFIG=false, ESLint v9 resolved the eslint.config file at the workspace root instead of them'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'can surface new lint errors'
    );
  });

  it('should report a project eslintrc under a base-only flat root as applied until this run', async () => {
    tree.write('eslint.base.config.mjs', 'export default [];');
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    tree.write('apps/app1/.eslintrc.json', JSON.stringify({ rules: {} }));

    const result = await update(tree);

    const context = result.agentContext.join('\n');
    expect(context).toContain(
      'These eslintrc files are still in the workspace: apps/app1/.eslintrc.json. The workspace root has eslint.base.config.mjs but no eslint.config file'
    );
    expect(context).not.toContain('resolved the eslint.config file');
    expect(result.nextSteps.join('\n')).toContain(
      'ESLint v10 does not read these eslintrc files, which this migration did not convert because the workspace root has eslint.base.config.mjs but no eslint.config file.'
    );
  });

  it('should not report an unparseable JavaScript config twice', async () => {
    tree.write('.eslintrc.js', 'module.exports = {');

    const result = await update(tree);

    const reports = result.agentContext.filter((entry) =>
      entry.includes('.eslintrc.js')
    );
    expect(reports).toHaveLength(1);
    expect(tree.exists('.eslintrc.js')).toBe(true);
  });

  it('should replace the plugins with no ESLint v10 release', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-jsx-a11y': '6.10.1',
      'eslint-plugin-react': '^7.35.0',
      'eslint-plugin-react-hooks': '5.0.0',
    });

    const result = await update(tree);

    const { devDependencies } = readJson(tree, 'package.json');
    expect(devDependencies['eslint-plugin-import']).toBeUndefined();
    expect(devDependencies['eslint-plugin-jsx-a11y']).toBeUndefined();
    expect(devDependencies['eslint-plugin-react']).toBeUndefined();
    expect(devDependencies['eslint-plugin-import-x']).toBe('^4.17.1');
    expect(devDependencies['eslint-plugin-react-hooks']).toBe('7.1.1');
    // Nothing referenced the removed plugins, so the react-hooks preset getting
    // wider is the only thing left to hand over.
    expect(result.agentContext).toHaveLength(1);
    expect(result.agentContext[0]).toContain(
      'its "recommended" preset grew from 2 rules to 16'
    );
    expect(result.agentContext[0]).toContain('React Compiler');
    expect(result.nextSteps.join('\n')).toContain(
      'Updated the ESLint plugins for v10'
    );
  });

  it('should remove the plugins from dependencies as well as devDependencies', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    updateJson(tree, 'package.json', (json) => {
      json.dependencies = { 'eslint-plugin-react': '^7.35.0' };
      return json;
    });

    await update(tree);

    expect(readJson(tree, 'package.json').dependencies).toEqual({});
  });

  it('should keep eslint-plugin-react-hooks when it already supports v10', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({ 'eslint-plugin-react-hooks': '^7.1.0' });

    await update(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      'eslint-plugin-react-hooks': '^7.1.0',
    });
  });

  it.each([
    ['eslint-plugin-react-hooks', '^7.0.0', '7.1.1'],
    ['eslint-plugin-import-x', '^4.10.0', '^4.17.1'],
  ])(
    'should update %s from %s, which predates its ESLint v10 support',
    async (name, from, to) => {
      tree.write('eslint.config.mjs', 'export default [];');
      setDevDependencies({ [name]: from });

      const result = await update(tree);

      expect(readJson(tree, 'package.json').devDependencies).toEqual({
        [name]: to,
      });
      // A 7.0 install already has the React Compiler rules in its preset.
      expect(result.agentContext).toEqual([]);
    }
  );

  it.each(['eslint-plugin-react-hooks', 'eslint-plugin-import-x'])(
    'should report %s instead of rewriting a specifier it cannot read',
    async (name) => {
      tree.write('eslint.config.mjs', 'export default [];');
      setDevDependencies({ [name]: 'workspace:*' });

      const result = await update(tree);

      expect(readJson(tree, 'package.json').devDependencies).toEqual({
        [name]: 'workspace:*',
      });
      expect(result.nextSteps.join('\n')).toContain(
        `${name} is declared as "workspace:*" and was not updated.`
      );
    }
  );

  it('should not install eslint-plugin-import-x when it is already there', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-import-x': '^4.16.2',
    });

    await update(tree);

    expect(readJson(tree, 'package.json').devDependencies).toEqual({
      'eslint-plugin-import-x': '^4.16.2',
    });
  });

  it('should deny the unrs-resolver build script when it installs eslint-plugin-import-x', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({ 'eslint-plugin-import': '2.31.0' });

    await withPnpm(tree, '11.2.2', () => update(tree));

    expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toMatch(
      /['"]?unrs-resolver['"]?: false/
    );
  });

  it('should not record an unrs-resolver decision when it installs no eslint-plugin-import-x', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({ 'eslint-plugin-react-hooks': '5.0.0' });

    await withPnpm(tree, '11.2.2', () => update(tree));

    expect(tree.read('pnpm-workspace.yaml', 'utf-8') ?? '').not.toContain(
      'unrs-resolver'
    );
  });

  it('should report the configs that import a removed plugin and not a JavaScript config that only names its rules', async () => {
    tree.write(
      'eslint.config.mjs',
      `import importPlugin from 'eslint-plugin-import';
       export default [{ plugins: { import: importPlugin } }];`
    );
    addProjectConfiguration(tree, 'app1', { root: 'apps/app1' });
    tree.write(
      'apps/app1/eslint.config.mjs',
      `export default [{ rules: { 'jsx-a11y/alt-text': 'warn' } }];`
    );
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-jsx-a11y': '6.10.1',
    });

    const result = await update(tree);

    const context = result.agentContext.join('\n');
    expect(context).toContain(
      'These files import plugins this migration removed because they have no ESLint v10 release: eslint.config.mjs (eslint-plugin-import).'
    );
    expect(context).not.toContain('apps/app1');
    expect(result.nextSteps.join('\n')).toContain(
      'Update these files, which import or name a plugin this migration removed: eslint.config.mjs.'
    );
  });

  it.each([
    ['.eslintrc.base.yaml', 'extends:\n  - plugin:jsx-a11y/recommended'],
    ['.eslintrc.base.yaml', 'extends: plugin:jsx-a11y/recommended'],
    ['.eslintrc.base.yaml', 'extends: [plugin:jsx-a11y/recommended]'],
    ['.eslintrc.base.yaml', 'rules:\n  jsx-a11y/alt-text: error'],
    ['.eslintrc.base.yaml', 'rules: {jsx-a11y/alt-text: error}'],
    ['.eslintrc', 'extends:\n  - plugin:jsx-a11y/recommended'],
  ])(
    'should report a leftover YAML eslintrc that names a removed plugin unquoted: %s %j',
    async (file, content) => {
      tree.write('eslint.config.mjs', 'export default [];');
      tree.write(file, `${content}\n`);
      setDevDependencies({ 'eslint-plugin-jsx-a11y': '6.10.1' });

      const result = await update(tree);

      const context = result.agentContext.join('\n');
      expect(context).toContain(
        `These eslintrc files are still in the workspace: ${file}.`
      );
      expect(context).toContain(
        `These eslintrc files name plugins this migration removed: ${file} (eslint-plugin-jsx-a11y).`
      );
    }
  );

  it('should report a module that imports a removed plugin but is not named like a config', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    tree.write(
      'tools/eslint/react.js',
      `const react = require('eslint-plugin-react');
       module.exports = { plugins: { react } };`
    );
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'tools/eslint/react.js (eslint-plugin-react)'
    );
  });

  it('should report the other module specifiers that load a removed plugin', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    tree.write(
      'tools/eslint/rules.ts',
      `export { rules } from 'eslint-plugin-react/configs/recommended';`
    );
    tree.write(
      'tools/eslint/lazy.ts',
      `export const load = () => import('eslint-plugin-jsx-a11y');`
    );
    // `require.resolve` never loads the module, but it throws MODULE_NOT_FOUND
    // once the package is gone, so it breaks like a plain require.
    tree.write(
      'tools/eslint/paths.js',
      `module.exports = require.resolve('eslint-plugin-react');`
    );
    tree.write(
      'tools/eslint/legacy.ts',
      `import a11y = require('eslint-plugin-jsx-a11y');
       export default a11y;`
    );
    tree.write(
      'tools/eslint/types.ts',
      `export type Rule = import('eslint-plugin-react').Rule;`
    );
    setDevDependencies({
      'eslint-plugin-jsx-a11y': '6.10.1',
      'eslint-plugin-react': '^7.35.0',
    });

    const result = await update(tree);

    const context = result.agentContext.join('\n');
    expect(context).toContain('tools/eslint/rules.ts (eslint-plugin-react)');
    expect(context).toContain('tools/eslint/lazy.ts (eslint-plugin-jsx-a11y)');
    expect(context).toContain('tools/eslint/paths.js (eslint-plugin-react)');
    expect(context).toContain(
      'tools/eslint/legacy.ts (eslint-plugin-jsx-a11y)'
    );
    expect(context).toContain('tools/eslint/types.ts (eslint-plugin-react)');
  });

  it('should not read a source file that only names a removed plugin as a reference', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    // Naming the package is not loading it: nothing here breaks when it goes.
    tree.write(
      'tools/generators/lint.spec.ts',
      `it('installs the plugin', () => {
         expect(devDependencies['eslint-plugin-react']).toBeDefined();
       });`
    );
    tree.write(
      'apps/app1/src/local.ts',
      `export { config } from './eslint-plugin-react';`
    );
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    const context = result.agentContext.join('\n');
    expect(context).not.toContain('lint.spec.ts');
    expect(context).not.toContain('local.ts');
  });

  it('should not read a quoted rule id outside a config file as a plugin reference', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    // `react/jsx-runtime` is an import path, not a rule id.
    tree.write(
      'apps/app1/src/main.tsx',
      `import { jsx } from 'react/jsx-runtime';`
    );
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(result.agentContext.join('\n')).not.toContain('main.tsx');
  });

  it.each([
    [
      'a block directive, deleting the comment it leaves empty',
      '/* eslint-disable react/no-danger */\nexport const a = 1;\n',
      'export const a = 1;\n',
    ],
    [
      'an eslint-enable directive',
      'export const a = 1;\n/* eslint-enable jsx-a11y/alt-text */\n',
      'export const a = 1;\n',
    ],
    [
      'a line directive after code',
      'export const a = 1; // eslint-disable-line react/no-danger\n',
      'export const a = 1;\n',
    ],
    [
      'a directive that keeps its other rules and its justification',
      "// eslint-disable-next-line jsx-a11y/alt-text, 'no-console' -- legacy\nconsole.log(1);\n",
      "// eslint-disable-next-line 'no-console' -- legacy\nconsole.log(1);\n",
    ],
    [
      'a directive that quotes the rule id',
      '/* eslint-disable "react/no-danger", no-console */\nconsole.log(1);\n',
      '/* eslint-disable no-console */\nconsole.log(1);\n',
    ],
    [
      'a directive between two tokens',
      'let/* eslint-disable react/no-danger */x = 1;\nexport { x };\n',
      'let x = 1;\nexport { x };\n',
    ],
  ])(
    'should remove the react/ and jsx-a11y/ rules from %s',
    async (_, before, after) => {
      tree.write('eslint.config.mjs', 'export default [];');
      tree.write('apps/app1/src/banner.tsx', before);
      setDevDependencies({
        'eslint-plugin-jsx-a11y': '6.10.1',
        'eslint-plugin-react': '^7.35.0',
      });

      const result = await update(tree);

      expect(tree.read('apps/app1/src/banner.tsx', 'utf-8')).toBe(after);
      expect(result.nextSteps.join('\n')).toContain(
        'from the ESLint directive comments in these files, and deleted the comments left with no rule: apps/app1/src/banner.tsx ('
      );
      expect(result.agentContext).toEqual([]);
    }
  );

  it('should report the import/ rules in directives and the removed rules an inline config sets', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write(
      'apps/app1/src/deps.ts',
      '/* eslint-disable import/no-cycle, react/no-danger */\n/* eslint react/no-danger: "error" */\nexport const deps = [];\n'
    );
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-react': '^7.35.0',
    });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/deps.ts', 'utf-8')).toBe(
      '/* eslint-disable import/no-cycle */\n/* eslint react/no-danger: "error" */\nexport const deps = [];\n'
    );
    expect(result.agentContext.join('\n')).toContain(
      'These source files carry ESLint directive comments naming rules from plugins this migration removed: apps/app1/src/deps.ts (import, react).'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'These source files have ESLint directive comments naming rules from the removed plugins: apps/app1/src/deps.ts.'
    );
  });

  it('should not report a rule prefix that is not inside an ESLint directive', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    const notes = `// we used to rely on react/no-danger here
/* eslint-disable-next-line no-console */
console.log('import/no-cycle');
`;
    tree.write('apps/app1/src/notes.ts', notes);
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-react': '^7.35.0',
    });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/notes.ts', 'utf-8')).toBe(notes);
    expect(
      [...result.agentContext, ...result.nextSteps].join('\n')
    ).not.toContain('notes.ts');
  });

  it('should not read a rule from a plugin namespace that ends in a removed prefix', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    const banner = `/* eslint-disable @eslint-react/dom-no-dangerously-set-innerhtml */
export const Banner = () => null;
`;
    tree.write('apps/app1/src/banner.tsx', banner);
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/banner.tsx', 'utf-8')).toBe(banner);
    expect(
      [...result.agentContext, ...result.nextSteps].join('\n')
    ).not.toContain('banner.tsx');
  });

  it('should leave the directives ESLint reads only from a block comment when a line comment holds them', async () => {
    tree.write('eslint.config.mjs', `export default [];`);
    const prose = `// eslint-disable react/no-danger
// eslint react/no-danger: "error"
export const prose = 1;
`;
    tree.write('apps/app1/src/prose.ts', prose);
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/prose.ts', 'utf-8')).toBe(prose);
    expect(
      [...result.agentContext, ...result.nextSteps].join('\n')
    ).not.toContain('prose.ts');
  });

  it.each([
    [
      'deletes',
      'function value(a) {\n  return /* eslint-env\n  node */ a;\n}\n',
      'eslint-env',
    ],
    [
      'rewrites',
      'function value(a) {\n  return /* eslint-disable react/no-danger,\n  no-console */ a;\n}\n',
      'react/no-danger',
    ],
  ])(
    'should keep the line break of a multi-line comment it %s',
    async (_, before, removed) => {
      tree.write('eslint.config.mjs', 'export default [];');
      tree.write('apps/app1/src/value.js', before);
      setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

      await update(tree);

      const content = tree.read('apps/app1/src/value.js', 'utf-8');
      expect(content).not.toContain(removed);
      // The line break ends the return statement, so the call returns nothing.
      expect(new Function(`${content}\nreturn value(1);`)()).toBeUndefined();
    }
  );

  it.each([
    [
      'the root package.json',
      () => setDevDependencies({ 'eslint-config-next': '^16.4.0' }),
    ],
    [
      'a project package.json',
      () =>
        tree.write(
          'apps/web/package.json',
          JSON.stringify({
            name: 'web',
            devDependencies: { 'eslint-config-next': '^16.4.0' },
          })
        ),
    ],
  ])(
    'should leave the directive comments when %s declares eslint-config-next',
    async (_, declareEslintConfigNext) => {
      tree.write('eslint.config.mjs', 'export default [];');
      const page = `// eslint-disable-next-line react/no-danger
export const Page = () => null;
`;
      tree.write('apps/web/src/page.tsx', page);
      setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });
      declareEslintConfigNext();

      const result = await update(tree);

      expect(tree.read('apps/web/src/page.tsx', 'utf-8')).toBe(page);
      expect(result.agentContext.join('\n')).toContain(
        'eslint-config-next is declared, and it registers eslint-plugin-react, eslint-plugin-jsx-a11y and eslint-plugin-import itself, so the ESLint directive comments naming their rules were not checked.'
      );
      expect(
        [...result.agentContext, ...result.nextSteps].join('\n')
      ).not.toContain('page.tsx');
    }
  );

  it('should not treat eslint-plugin-import-x as a reference to eslint-plugin-import', async () => {
    tree.write(
      'eslint.config.mjs',
      `import importX from 'eslint-plugin-import-x';
       export default [{ plugins: { 'import-x': importX }, rules: { 'import-x/first': 'error' } }];`
    );
    const deps = `// eslint-disable-next-line import-x/no-cycle
export const deps = [];
`;
    tree.write('apps/app1/src/deps.ts', deps);
    setDevDependencies({ 'eslint-plugin-import': '2.31.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/deps.ts', 'utf-8')).toBe(deps);
    expect(result.agentContext).toEqual([]);
  });

  it('should delete /* eslint-env */ comments when the workspace had no eslintrc config', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write(
      'apps/app1/src/server.js',
      '/* eslint-env node */\nmodule.exports = { port: process.env.PORT };\n'
    );
    tree.write(
      'apps/app1/src/worker.ts',
      "export const ping = () => self.postMessage('ping'); /* eslint-env browser, jest */\n"
    );

    const result = await update(tree);

    expect(tree.read('apps/app1/src/server.js', 'utf-8')).toBe(
      'module.exports = { port: process.env.PORT };\n'
    );
    expect(tree.read('apps/app1/src/worker.ts', 'utf-8')).toBe(
      "export const ping = () => self.postMessage('ping');\n"
    );
    expect(result.agentContext).toEqual([]);
    expect(result.nextSteps.join('\n')).toContain(
      'The workspace had no eslintrc config, so ESLint never applied their globals: apps/app1/src/server.js, apps/app1/src/worker.ts.'
    );
  });

  it.each([
    [
      'an /* eslint-env */ comment under an eslint-disable-next-line',
      '// eslint-disable-next-line no-console\n/* eslint-env node */\nconsole.log(1);\n',
    ],
    [
      'an emptied directive under an eslint-disable-next-line',
      '// eslint-disable-next-line no-console\n// eslint-disable-next-line react/no-danger\nconsole.log(1);\n',
    ],
    [
      'an /* eslint-env */ comment a blank line under a @ts-ignore',
      "// @ts-ignore\n\n/* eslint-env node */\nexport const x: number = 'a';\n",
    ],
    [
      'an /* eslint-env */ comment beside an emptied directive, under a @ts-ignore',
      "// @ts-ignore\n/* eslint-env node */ /* eslint-disable react/no-danger */\nexport const value: number = 'wrong';\n",
    ],
    [
      'a multi-line /* eslint-env */ comment before code, under a @ts-ignore',
      "// @ts-ignore\n/* eslint-env\n  node */ export const x: number = 'a';\n",
    ],
  ])('should keep and report %s', async (_, main) => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write('apps/app1/src/main.ts', main);
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/main.ts', 'utf-8')).toBe(main);
    expect(
      result.nextSteps.filter((step) => step.includes('apps/app1/src/main.ts'))
    ).toEqual([
      expect.stringContaining(
        'because a comment ends on the line above each one: apps/app1/src/main.ts.'
      ),
    ]);
  });

  it.each([
    [
      'an eslintrc file this run converts',
      (tree: Tree) => tree.write('.eslintrc.json', '{ "root": true }'),
    ],
    [
      'an eslintConfig in package.json',
      (tree: Tree) => {
        tree.write('eslint.config.mjs', 'export default [];');
        updateJson(tree, 'package.json', (json) => ({
          ...json,
          eslintConfig: { env: { node: true } },
        }));
      },
    ],
  ])(
    'should report /* eslint-env */ comments when the workspace had %s',
    async (_, addEslintrcConfig) => {
      addEslintrcConfig(tree);
      const server = '/* eslint-env node */\nmodule.exports = {};\n';
      tree.write('apps/app1/src/server.js', server);

      const result = await update(tree);

      expect(tree.read('apps/app1/src/server.js', 'utf-8')).toBe(server);
      expect(result.agentContext.join('\n')).toContain(
        'These source files carry /* eslint-env */ comments: apps/app1/src/server.js.'
      );
      expect(result.nextSteps.join('\n')).toContain(
        'ESLint v10 reports /* eslint-env */ comments as errors; replace them with /* global */ comments or languageOptions.globals in: apps/app1/src/server.js.'
      );
    }
  );

  it('should leave a line-comment eslint-env, which ESLint never read', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write('apps/app1/src/server.js', '// eslint-env node\n');

    const result = await update(tree);

    expect(tree.read('apps/app1/src/server.js', 'utf-8')).toBe(
      '// eslint-env node\n'
    );
    expect(result.nextSteps).toEqual([]);
  });

  it.each([
    [
      'the words eslint-env mid-comment',
      "/* we dropped the eslint-env comments already */\nexport const note = 'ok';\n",
    ],
    [
      'a block comment inside a line comment',
      '// Example: /* eslint-env node */\n',
    ],
    [
      'a line directive inside a block comment',
      '/* Example:\n// eslint-disable-next-line react/no-danger\n*/\n',
    ],
    [
      'a rule named in the justification of a directive',
      "// eslint-disable-next-line no-console -- replaces react/no-danger\nconsole.log('hello');\n",
    ],
  ])('should not read %s as a directive', async (_, content) => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write('apps/app1/src/notes.ts', content);
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/notes.ts', 'utf-8')).toBe(content);
    expect(
      [...result.agentContext, ...result.nextSteps].join('\n')
    ).not.toContain('notes.ts');
  });

  it('should not read a directive inside a literal or JSX text as a comment', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    const fixtures = `export const env = '/* eslint-env node */';
export const disable = \`/* eslint-disable react/no-danger */\`;
export const matcher = /\\/\\* eslint-env node \\*\\//;
export const Banner = () => <p>/* eslint-env browser */</p>;
`;
    tree.write('apps/app1/src/fixtures.tsx', fixtures);
    setDevDependencies({ 'eslint-plugin-react': '^7.35.0' });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/fixtures.tsx', 'utf-8')).toBe(fixtures);
    expect(
      [...result.agentContext, ...result.nextSteps].join('\n')
    ).not.toContain('fixtures.tsx');
  });

  it('should still read the real comments of a file that also quotes one', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    tree.write(
      'apps/app1/src/fixtures.ts',
      `/* eslint-env node */
// eslint-disable-next-line react/no-danger -- legacy markup
export const quoted = '/* eslint-disable jsx-a11y/alt-text */';
`
    );
    setDevDependencies({
      'eslint-plugin-jsx-a11y': '6.10.1',
      'eslint-plugin-react': '^7.35.0',
    });

    const result = await update(tree);

    expect(tree.read('apps/app1/src/fixtures.ts', 'utf-8')).toBe(
      "export const quoted = '/* eslint-disable jsx-a11y/alt-text */';\n"
    );
    expect(result.nextSteps.join('\n')).toContain(
      'apps/app1/src/fixtures.ts (react)'
    );
  });

  it('should report plugins whose peer range excludes the ESLint the workspace lands on', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      eslint: '^10.0.0',
      'eslint-plugin-jest': '^28.11.0',
      '@acme/eslint-plugin': '^23.2.0',
      'eslint-config-prettier': '^10.0.0',
      'eslint-plugin-storybook': '^0.11.0',
      // Carries rules without being named like a plugin.
      'angular-eslint': '^21.2.0',
      typescript: '~5.9.0',
    });
    mockEslintPeerRanges(
      {
        'eslint-plugin-jest': '^7.0.0 || ^8.0.0 || ^9.0.0',
        '@acme/eslint-plugin': '^9.0.0',
        'eslint-config-prettier': '>=7.0.0',
        // An open range admits v10 without proving support, so it stays unreported.
        'eslint-plugin-storybook': '>=6',
        'angular-eslint': '^8.57.0 || ^9.0.0',
      },
      /* installedEslintVersion */ '10.8.0'
    );

    const result = await update(tree);

    const context = result.agentContext.join('\n');
    expect(context).toContain(
      'eslint-plugin-jest (peer eslint ^7.0.0 || ^8.0.0 || ^9.0.0)'
    );
    expect(context).toContain('@acme/eslint-plugin (peer eslint ^9.0.0)');
    expect(context).toContain('angular-eslint (peer eslint ^8.57.0 || ^9.0.0)');
    expect(context).not.toContain('eslint-config-prettier');
    expect(context).not.toContain('eslint-plugin-storybook');
    expect(context).toContain('treat a clean run of lint as the real answer');
    expect(result.nextSteps.join('\n')).toContain(
      'so update or replace them: eslint-plugin-jest, @acme/eslint-plugin, angular-eslint'
    );
  });

  it('should check plugin peer ranges against the installed eslint, not the declared range', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    // A range still spanning both majors coerces to 9, which would clear a
    // plugin that the ESLint actually installed rules out.
    setDevDependencies({
      eslint: '^9.8.0 || ^10.0.0',
      'eslint-plugin-jest': '^28.11.0',
    });
    mockEslintPeerRanges(
      { 'eslint-plugin-jest': '^9.0.0' },
      /* installedEslintVersion */ '10.8.0'
    );

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'excludes ESLint 10.8.0: eslint-plugin-jest (peer eslint ^9.0.0)'
    );
  });

  it('should say the peer scan did not run when eslint does not resolve', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      eslint: '^10.0.0',
      'eslint-plugin-jest': '^28.11.0',
    });
    mockEslintPeerRanges({ 'eslint-plugin-jest': '^9.0.0' });

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'The check for ESLint plugins without a v10 release did not run'
    );
    expect(result.agentContext.join('\n')).not.toContain('eslint-plugin-jest');
    expect(result.nextSteps.join('\n')).toContain(
      'because eslint does not resolve from the workspace root'
    );
  });

  it('should say the peer scan did not run when the install has not caught up', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      eslint: '^10.0.0',
      'eslint-plugin-jest': '^28.11.0',
    });
    // `--skipInstall` leaves node_modules on the pre-migration versions, so every
    // peer range the scan could read is the one that shipped with ESLint v9.
    mockEslintPeerRanges(
      { 'eslint-plugin-jest': '^9.0.0' },
      /* installedEslintVersion */ '9.39.4'
    );

    const result = await update(tree);

    expect(result.agentContext.join('\n')).toContain(
      'The check for ESLint plugins without a v10 release did not run'
    );
    expect(result.agentContext.join('\n')).not.toContain('eslint-plugin-jest');
    expect(result.nextSteps.join('\n')).toContain(
      'because node_modules still holds ESLint 9.39.4'
    );
  });

  it('should not report a plugin whose package.json entry this migration moved past the install', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    setDevDependencies({
      eslint: '^10.0.0',
      'eslint-plugin-jest': '^28.11.0',
      'eslint-plugin-react-hooks': '^5.2.0',
    });
    // react-hooks is bumped to v7 by this same run, so the range read here is
    // the one from the v5 release that bump replaces.
    mockEslintPeerRanges(
      {
        'eslint-plugin-jest': '^9.0.0',
        'eslint-plugin-react-hooks':
          '^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0',
      },
      /* installedEslintVersion */ '10.8.0'
    );

    const result = await update(tree);

    expect(
      readJson(tree, 'package.json').devDependencies[
        'eslint-plugin-react-hooks'
      ]
    ).toBe(ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION);
    expect(
      result.nextSteps.find((step) =>
        step.includes('so update or replace them')
      )
    ).toBe(
      'These packages declare an ESLint peer range that excludes ESLint 10.8.0, so update or replace them: eslint-plugin-jest.'
    );
  });

  it('should report the rules @eslint/js newly enables when the conversion adds it', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, extends: ['eslint:recommended'] })
    );
    setDevDependencies({ eslint: '^10.0.0' });

    const result = await update(tree);

    expect(readJson(tree, 'package.json').devDependencies['@eslint/js']).toBe(
      '^10.0.0'
    );
    expect(result.nextSteps.join('\n')).toContain(
      'no-unassigned-vars, no-useless-assignment and preserve-caught-error'
    );
    expect(result.agentContext.join('\n')).toContain(
      'The conversion added @eslint/js to package.json'
    );
  });

  it('should not report the @eslint/js rules when the conversion stayed on the v9 stack', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, extends: ['eslint:recommended'] })
    );
    setDevDependencies({ eslint: '^9.8.0' });

    const result = await update(tree);

    // Those three rules are only in the ESLint v10 recommended set.
    expect(readJson(tree, 'package.json').devDependencies['@eslint/js']).toBe(
      '^9.8.0'
    );
    expect(result.nextSteps.join('\n')).not.toContain('@eslint/js');
  });

  it('should not report @eslint/js when the workspace already had it', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, extends: ['eslint:recommended'] })
    );
    setDevDependencies({ '@eslint/js': '^9.0.0' });

    const result = await update(tree);

    expect(result.agentContext.join('\n')).not.toContain('@eslint/js');
    expect(result.nextSteps.join('\n')).not.toContain('@eslint/js');
  });

  it('should report the Node.js requirement when engines.node allows an unsupported version', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    updateJson(tree, 'package.json', (json) => {
      json.engines = { node: '>=18.0.0' };
      return json;
    });

    const result = await update(tree);

    expect(result.nextSteps.join('\n')).toContain(
      'ESLint v10 requires Node.js ^20.19.0 || ^22.13.0 || >=24'
    );
  });

  it('should not report the Node.js requirement when engines.node is already narrow enough', async () => {
    tree.write('eslint.config.mjs', 'export default [];');
    updateJson(tree, 'package.json', (json) => {
      json.engines = { node: '>=24.0.0' };
      return json;
    });

    const result = await update(tree);

    expect(result.nextSteps).toEqual([]);
  });

  it('should be idempotent', async () => {
    tree.write(
      '.eslintrc.json',
      JSON.stringify({ root: true, rules: { 'no-console': 'error' } })
    );
    setDevDependencies({
      'eslint-plugin-import': '2.31.0',
      'eslint-plugin-react-hooks': '5.0.0',
    });

    await update(tree);
    const afterFirstRun = {
      config: tree.read('eslint.config.mjs', 'utf-8'),
      packageJson: tree.read('package.json', 'utf-8'),
    };

    const result = await update(tree);

    expect(tree.read('eslint.config.mjs', 'utf-8')).toBe(afterFirstRun.config);
    expect(tree.read('package.json', 'utf-8')).toBe(afterFirstRun.packageJson);
    expect(result.agentContext).toEqual([]);
  });

  // The plugin list is a frozen copy of `@nx/react`'s ESLint <10 stack; `@nx/eslint`
  // cannot import it. Fail here when that stack gains or loses a plugin.
  it('should stay in sync with the plugin set @nx/react installs for ESLint <10', () => {
    const legacyDependencies = readTopLevelInitializer(
      join(__dirname, '../../../../react/src/utils/lint.ts'),
      'eslintLegacyDependencies'
    ) as ts.ObjectLiteralExpression | undefined;
    const devDependencies = legacyDependencies?.properties.find(
      (property): property is ts.PropertyAssignment =>
        ts.isPropertyAssignment(property) &&
        ts.isIdentifier(property.name) &&
        property.name.text === 'devDependencies'
    );
    const installedPlugins = (
      devDependencies?.initializer as ts.ObjectLiteralExpression
    ).properties.map((property) => (property.name as ts.StringLiteral).text);

    expect(installedPlugins).not.toHaveLength(0);
    // react-hooks ships for every ESLint major, so it is updated rather than removed.
    expect(installedPlugins.sort()).toEqual(
      [...V9_ONLY_PLUGINS, 'eslint-plugin-react-hooks'].sort()
    );
  });

  // Same frozen-copy problem for the two replacement versions this migration installs.
  it('should stay in sync with the plugin versions @nx/react installs for ESLint v10', () => {
    const readVersion = (name: string): string | undefined =>
      (
        readTopLevelInitializer(
          join(__dirname, '../../../../react/src/utils/versions.ts'),
          name
        ) as ts.StringLiteral | undefined
      )?.text;

    expect(readVersion('eslintPluginImportXVersion')).toBe(
      ESLINT_PLUGIN_IMPORT_X_VERSION
    );
    expect(readVersion('eslintPluginReactHooksV7Version')).toBe(
      ESLINT_PLUGIN_REACT_HOOKS_V7_VERSION
    );
  });
});

function readTopLevelInitializer(
  filePath: string,
  name: string
): ts.Expression | undefined {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf-8'),
    ts.ScriptTarget.Latest
  );
  return source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === name
    )?.initializer;
}
