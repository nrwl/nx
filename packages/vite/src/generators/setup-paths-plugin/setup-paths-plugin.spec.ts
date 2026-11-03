import {
  ProjectGraph,
  stripIndents,
  Tree,
  updateJson,
  readJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setupPathsPlugin } from './setup-paths-plugin';

let projectGraph: ProjectGraph;
vi.mock('@nx/devkit', async () => ({
  ...(await vi.importActual<any>('@nx/devkit')),
  createProjectGraphAsync: vi.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vite:setup-paths-plugin', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
  });

  it('should enable resolve.tsconfigPaths in vite config files', async () => {
    tree.write(
      'proj1/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      export default defineConfig({});`
    );
    tree.write(
      'proj2/vite.config.ts',
      stripIndents`
    import { defineConfig } from 'vite'
    import react from '@vitejs/plugin-react'
    export default defineConfig({
      plugins: [react()],
    })`
    );
    tree.write(
      'proj3/vite.config.cts',
      stripIndents`
      const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');
      module.exports = defineConfig({
        plugins: [react()],
      });
      `
    );

    await setupPathsPlugin(tree, {});

    expect(tree.read('proj1/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
      });
      "
    `);
    expect(tree.read('proj2/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [react()],
      });
      "
    `);
    expect(tree.read('proj3/vite.config.cts').toString())
      .toMatchInlineSnapshot(`
      "const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');
      module.exports = defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [react()],
      });
      "
    `);
  });

  it('should preserve an existing resolve option and skip configs that already set tsconfigPaths', async () => {
    tree.write(
      'proj1/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
      });`
    );
    tree.write(
      'proj2/vite.config.ts',
      stripIndents`
    import { defineConfig } from 'vite'
    export default defineConfig({
      resolve: {
        alias: { '@app': './src' },
      },
    })`
    );

    await setupPathsPlugin(tree, {});

    expect(tree.read('proj1/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
      });
      "
    `);
    expect(tree.read('proj2/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
          alias: { '@app': './src' },
        },
      });
      "
    `);
  });
  it.each([5, 6, 7])(
    'should install a compatible paths plugin for Vite %s',
    async (version) => {
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        devDependencies: { vite: `^${version}.0.0` },
      }));
      tree.write('vite.config.cts', 'module.exports = { plugins: [] };');
      await setupPathsPlugin(tree, {});
      const content = tree.read('vite.config.cts', 'utf-8');
      expect(content).toContain("require('vite-tsconfig-paths').default");
      expect(content).toContain('plugins: [tsconfigPaths({ loose: true })]');
      expect(content).not.toContain('tsconfigPaths: true');
      expect(
        readJson(tree, 'package.json').devDependencies['vite-tsconfig-paths']
      ).toBe('~4.3.2');
      await setupPathsPlugin(tree, {});
      expect(tree.read('vite.config.cts', 'utf-8')).toBe(content);
    }
  );
});
