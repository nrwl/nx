import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import type { Tree } from '@nx/devkit';
import update, {
  rewriteJestProjectGeneratorUsage,
} from './rewrite-jest-project-generator';

describe('rewrite-jest-project-generator migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('rewriteJestProjectGeneratorUsage (pure)', () => {
    it('renames a plain import and its call sites', () => {
      const source = [
        `import { jestProjectGenerator } from '@nx/jest';`,
        ``,
        `export async function run(tree) {`,
        `  await jestProjectGenerator(tree, { project: 'app' });`,
        `}`,
        ``,
      ].join('\n');
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(
        [
          `import { configurationGenerator } from '@nx/jest';`,
          ``,
          `export async function run(tree) {`,
          `  await configurationGenerator(tree, { project: 'app' });`,
          `}`,
          ``,
        ].join('\n')
      );
    });

    it('renames only the imported name for an aliased import', () => {
      const source = [
        `import { jestProjectGenerator as jestGen } from '@nx/jest';`,
        `jestGen(tree, {});`,
        ``,
      ].join('\n');
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(
        [
          `import { configurationGenerator as jestGen } from '@nx/jest';`,
          `jestGen(tree, {});`,
          ``,
        ].join('\n')
      );
    });

    it('keeps other named imports intact', () => {
      const source = `import { jestProjectGenerator, jestInitGenerator } from '@nx/jest';\n`;
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(
        `import { configurationGenerator, jestInitGenerator } from '@nx/jest';\n`
      );
    });

    it('aliases instead of colliding when configurationGenerator is already imported', () => {
      const source = [
        `import { configurationGenerator, jestProjectGenerator } from '@nx/jest';`,
        `jestProjectGenerator(tree, {});`,
        `configurationGenerator(tree, {});`,
        ``,
      ].join('\n');
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(
        [
          `import { configurationGenerator, configurationGenerator as jestProjectGenerator } from '@nx/jest';`,
          `jestProjectGenerator(tree, {});`,
          `configurationGenerator(tree, {});`,
          ``,
        ].join('\n')
      );
    });

    it('leaves jestProjectGenerator imported from another package alone', () => {
      const source = `import { jestProjectGenerator } from 'some-other-pkg';\n`;
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(source);
    });

    it('leaves an unrelated member access alone', () => {
      const source = [
        `import { jestProjectGenerator } from '@nx/jest';`,
        `helpers.jestProjectGenerator();`,
        `jestProjectGenerator(tree, {});`,
        ``,
      ].join('\n');
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(
        [
          `import { configurationGenerator } from '@nx/jest';`,
          `helpers.jestProjectGenerator();`,
          `configurationGenerator(tree, {});`,
          ``,
        ].join('\n')
      );
    });

    it('leaves unrelated string literals alone', () => {
      const source = `const name = 'jestProjectGenerator';\n`;
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(source);
    });

    it('returns the source unchanged when there is no match', () => {
      const source = `import { jestInitGenerator } from '@nx/jest';\n`;
      expect(rewriteJestProjectGeneratorUsage(source)).toBe(source);
    });
  });

  describe('default export (Tree)', () => {
    it('rewrites usages across .ts files', async () => {
      tree.write(
        'libs/my-plugin/src/index.ts',
        `import { jestProjectGenerator } from '@nx/jest';\nexport const run = jestProjectGenerator;\n`
      );
      await update(tree);
      const updated = tree.read('libs/my-plugin/src/index.ts', 'utf-8');
      expect(updated).toContain(
        `import { configurationGenerator } from '@nx/jest';`
      );
      expect(updated).not.toContain('jestProjectGenerator');
    });

    it('is a no-op for files that do not reference jestProjectGenerator', async () => {
      const original = `import { jestInitGenerator } from '@nx/jest';\n`;
      tree.write('libs/my-plugin/src/index.ts', original);
      await update(tree);
      expect(tree.read('libs/my-plugin/src/index.ts', 'utf-8')).toBe(original);
    });
  });
});
