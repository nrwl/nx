import { ProjectGraph, stripIndents, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { setupPathsPlugin } from './setup-paths-plugin';

let projectGraph: ProjectGraph;
jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  createProjectGraphAsync: jest.fn().mockImplementation(async () => {
    return projectGraph;
  }),
}));

describe('@nx/vite:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    projectGraph = {
      nodes: {},
      dependencies: {},
    };
  });

  it('should add nxViteTsPaths plugin to vite config files', async () => {
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
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({ plugins: [nxViteTsPaths()] });
      "
    `);
    expect(tree.read('proj2/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
    expect(tree.read('proj3/vite.config.cts').toString())
      .toMatchInlineSnapshot(`
      "const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');
      const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');
      module.exports = defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
  });

  it('should not add nxViteTsPaths plugin to vite config files when it exists', async () => {
    tree.write(
      'proj1/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
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
      const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');
      module.exports = defineConfig({
        plugins: [react()],
      });
      `
    );

    await setupPathsPlugin(tree, {});

    expect(tree.read('proj1/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({ plugins: [nxViteTsPaths()] });
      "
    `);
    expect(tree.read('proj2/vite.config.ts').toString()).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      export default defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
    expect(tree.read('proj3/vite.config.cts').toString())
      .toMatchInlineSnapshot(`
      "const { defineConfig } = require('vite');
      const react = require('@vitejs/plugin-react');
      const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');
      module.exports = defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });
      "
    `);
  });
});
