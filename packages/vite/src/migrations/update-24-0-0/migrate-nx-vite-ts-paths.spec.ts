import { stripIndents, updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migrateNxViteTsPaths from './migrate-nx-vite-ts-paths';

describe('migrate-nx-vite-ts-paths', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    setViteVersion('^8.0.0');
  });

  function setViteVersion(version: string) {
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, vite: version };
      return json;
    });
  }

  it('should replace the plugin with native tsconfig paths resolution', async () => {
    tree.write(
      'apps/demo/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
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
  });

  it('should drop buildLibsFromSource options and a sole plugin entry', async () => {
    tree.write(
      'libs/ui/vitest.config.mts',
      stripIndents`
      import { defineConfig } from 'vite';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig({
        plugins: [nxViteTsPaths({ buildLibsFromSource: false })],
      });`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('libs/ui/vitest.config.mts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [],
      });
      "
    `);
  });

  it('should handle require form and the generated worker comment', async () => {
    tree.write(
      'apps/demo/vite.config.cts',
      stripIndents`
      const { defineConfig } = require('vite');
      const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin');

      module.exports = defineConfig({
        plugins: [nxViteTsPaths()],
        // Uncomment this if you are using workers.
        // worker: {
        //   plugins: () => [ nxViteTsPaths() ],
        // },
      });`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.cts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "const { defineConfig } = require('vite');

      module.exports = defineConfig({
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [],
        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [],
        // },
      });
      "
    `);
  });

  it('should preserve an existing resolve option', async () => {
    tree.write(
      'apps/demo/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig({
        resolve: {
          alias: { '@app': './src' },
        },
        plugins: [nxViteTsPaths()],
      });`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          tsconfigPaths: true,
          alias: { '@app': './src' },
        },
        plugins: [],
      });
      "
    `);
  });

  it('should leave configs without the plugin alone', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';

    export default defineConfig({
      resolve: {
        tsconfigPaths: true,
      },
    });`;
    tree.write('apps/demo/vite.config.ts', content);

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toBe(content);
  });

  it('should edit a factory config, which is what the generators emit', async () => {
    tree.write(
      'apps/demo/vite.config.ts',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig(() => ({
        plugins: [react(), nxViteTsPaths()],
      }));`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig(() => ({
        resolve: {
          tsconfigPaths: true,
        },
        plugins: [react()],
      }));
      "
    `);
  });

  it('should leave a config alone when the plugin call is not an array element', async () => {
    const content = stripIndents`
    import { defineConfig } from 'vite';
    import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

    const enabled = true;

    export default defineConfig({
      plugins: [enabled && nxViteTsPaths()],
    });`;
    tree.write('apps/demo/vite.config.ts', content);

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toBe(content);
  });

  it('should keep an import statement that also binds something else', async () => {
    tree.write(
      'apps/demo/vite.config.cts',
      stripIndents`
      const { defineConfig } = require('vite');
      const { nxViteTsPaths } = require('@nx/vite/plugins/nx-tsconfig-paths.plugin'),
        react = require('@vitejs/plugin-react');

      module.exports = defineConfig({
        plugins: [react(), nxViteTsPaths()],
      });`
    );

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.cts', 'utf-8')).toContain(
      "react = require('@vitejs/plugin-react')"
    );
    expect(tree.read('apps/demo/vite.config.cts', 'utf-8')).toContain(
      'plugins: [react()]'
    );
  });

  it('should not run on workspaces below Vite 8, where the option is ignored', async () => {
    setViteVersion('^7.0.0');
    const content = stripIndents`
    import { defineConfig } from 'vite';
    import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

    export default defineConfig({
      plugins: [nxViteTsPaths()],
    });`;
    tree.write('apps/demo/vite.config.ts', content);

    await migrateNxViteTsPaths(tree);

    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toBe(content);
  });
});
