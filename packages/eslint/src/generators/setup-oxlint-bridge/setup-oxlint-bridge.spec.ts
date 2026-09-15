import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import {
  setupOxlintBridgeGenerator,
  injectOxlintBridge,
} from './setup-oxlint-bridge';

describe('setup-oxlint-bridge', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('generator', () => {
    it('should throw if no ESLint config exists', async () => {
      await expect(setupOxlintBridgeGenerator(tree, {})).rejects.toThrow(
        'No ESLint config file found'
      );
    });

    it('should throw if ESLint config is not flat config', async () => {
      tree.write('.eslintrc.json', JSON.stringify({ root: true, rules: {} }));
      await expect(setupOxlintBridgeGenerator(tree, {})).rejects.toThrow(
        'does not appear to be a flat config'
      );
    });

    it('should skip if eslint-plugin-oxlint is already present', async () => {
      tree.write(
        'eslint.config.mjs',
        `import oxlint from 'eslint-plugin-oxlint';\nexport default [];\n`
      );
      const callback = await setupOxlintBridgeGenerator(tree, {});
      // Content should not be modified further
      const content = tree.read('eslint.config.mjs', 'utf-8');
      expect(content).toContain('eslint-plugin-oxlint');
      expect(content).not.toContain('buildFromOxlintConfig');
    });

    it('should add dependencies to package.json', async () => {
      tree.write(
        'eslint.config.mjs',
        [
          `import nx from '@nx/eslint-plugin';`,
          '',
          'export default [',
          '  ...nx.configs["flat/base"],',
          '];',
          '',
        ].join('\n')
      );

      await setupOxlintBridgeGenerator(tree, {});

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.devDependencies['eslint-plugin-oxlint']).toBeDefined();
      expect(packageJson.devDependencies['jiti']).toBeDefined();
    });

    it('should inject the bridge into eslint.config.mjs', async () => {
      tree.write(
        'eslint.config.mjs',
        [
          `import nx from '@nx/eslint-plugin';`,
          '',
          'export default [',
          '  ...nx.configs["flat/base"],',
          '];',
          '',
        ].join('\n')
      );

      await setupOxlintBridgeGenerator(tree, {});

      const content = tree.read('eslint.config.mjs', 'utf-8');
      expect(content).toContain(`import oxlint from 'eslint-plugin-oxlint'`);
      expect(content).toContain(`import { createJiti } from 'jiti'`);
      expect(content).toContain('createJiti(import.meta.url)');
      expect(content).toContain('jiti.import');
      expect(content).toContain("reportUnusedDisableDirectives: 'off'");
      expect(content).toContain('buildFromOxlintConfig(oxlintConfig)');
    });

    it('should respect custom oxlintConfigPath', async () => {
      tree.write(
        'eslint.config.mjs',
        [
          `import nx from '@nx/eslint-plugin';`,
          '',
          'export default [',
          '  ...nx.configs["flat/base"],',
          '];',
          '',
        ].join('\n')
      );

      await setupOxlintBridgeGenerator(tree, {
        oxlintConfigPath: './tools/oxlint.config.ts',
      });

      const content = tree.read('eslint.config.mjs', 'utf-8');
      expect(content).toContain('./tools/oxlint.config.ts');
    });

    it('should not add deps when skipPackageJson is true', async () => {
      tree.write(
        'eslint.config.mjs',
        `import nx from '@nx/eslint-plugin';\nexport default [];\n`
      );

      await setupOxlintBridgeGenerator(tree, { skipPackageJson: true });

      const packageJson = readJson(tree, 'package.json');
      expect(
        packageJson.devDependencies?.['eslint-plugin-oxlint']
      ).toBeUndefined();
    });
  });

  describe('injectOxlintBridge', () => {
    it('should inject ESM bridge correctly', () => {
      const input = [
        `import nx from '@nx/eslint-plugin';`,
        '',
        'export default [',
        '  ...nx.configs["flat/base"],',
        '  ...nx.configs["flat/typescript"],',
        '];',
      ].join('\n');

      const result = injectOxlintBridge(input, 'mjs', './oxlint.config.ts');

      expect(result).toContain(`import oxlint from 'eslint-plugin-oxlint'`);
      expect(result).toContain(`import { createJiti } from 'jiti'`);
      expect(result).toContain('createJiti(import.meta.url)');
      expect(result).toContain(`await jiti.import('./oxlint.config.ts')`);
      expect(result).toContain("reportUnusedDisableDirectives: 'off'");
      expect(result).toContain('...oxlint.buildFromOxlintConfig(oxlintConfig)');
      // buildFromOxlintConfig should be the last thing before ];
      const closingIdx = result.lastIndexOf('];');
      const beforeClosing = result.slice(0, closingIdx);
      expect(beforeClosing.trimEnd()).toMatch(
        /buildFromOxlintConfig\(oxlintConfig\),?$/
      );
    });

    it('should inject CJS bridge correctly', () => {
      const input = [
        `const nx = require('@nx/eslint-plugin');`,
        '',
        'module.exports = [',
        '  ...nx.configs["flat/base"],',
        '];',
      ].join('\n');

      const result = injectOxlintBridge(input, 'cjs', './oxlint.config.ts');

      expect(result).toContain(`require('eslint-plugin-oxlint')`);
      expect(result).toContain(`require('jiti')`);
      expect(result).toContain('createJiti(__filename)');
      expect(result).toContain("reportUnusedDisableDirectives: 'off'");
      expect(result).toContain('...oxlint.buildFromOxlintConfig(oxlintConfig)');
    });

    it('should add trailing comma to last existing element', () => {
      const input = [
        `import nx from '@nx/eslint-plugin';`,
        '',
        'export default [',
        '  ...nx.configs["flat/base"]',
        '];',
      ].join('\n');

      const result = injectOxlintBridge(input, 'mjs', './oxlint.config.ts');

      // The existing element without trailing comma should get one
      expect(result).toContain('flat/base"],');
    });

    it('should not duplicate comma if already present', () => {
      const input = [
        `import nx from '@nx/eslint-plugin';`,
        '',
        'export default [',
        '  ...nx.configs["flat/base"],',
        '];',
      ].join('\n');

      const result = injectOxlintBridge(input, 'mjs', './oxlint.config.ts');

      // Should not produce double comma
      expect(result).not.toContain(',,');
    });

    it('should preserve the export default structure', () => {
      const input = [
        `import nx from '@nx/eslint-plugin';`,
        `import globals from 'globals';`,
        '',
        'export default [',
        '  { ignores: ["**/dist"] },',
        '  ...nx.configs["flat/base"],',
        '  { languageOptions: { globals: { ...globals.browser } } },',
        '];',
      ].join('\n');

      const result = injectOxlintBridge(input, 'mjs', './oxlint.config.ts');

      expect(result).toContain('export default [');
      expect(result).toContain('{ ignores: ["**/dist"] }');
      expect(result).toContain('flat/base');
      expect(result).toContain('globals.browser');
      expect(result).toContain('buildFromOxlintConfig');
      expect(result).toMatch(/\];/);
    });
  });
});
