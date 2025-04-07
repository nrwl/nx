import { addProjectConfiguration, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './remove-experimental-fetch-polyfill';

describe('remove-experimental-fetch-polyfill', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should do nothing when there are no projects with cypress config', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.exists('apps/app1-e2e/cypress.config.ts')).toBe(false);
  });

  it('should do nothing when the cypress config cannot be parsed as expected', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });
    tree.write('apps/app1-e2e/cypress.config.ts', `export const foo = 'bar';`);

    await expect(migration(tree)).resolves.not.toThrow();
    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "export const foo = 'bar';
      "
    `);
  });

  it('should handle when the cypress config path in the executor is not valid', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/non-existent-cypress.config.ts',
          },
        },
      },
    });

    await expect(migration(tree)).resolves.not.toThrow();
  });

  it('should remove the experimentalFetchPolyfill property even if defined multiple times', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {},
    });
    tree.write(
      'apps/app1-e2e/cypress.config.ts',
      `import { defineConfig } from 'cypress';

export default defineConfig({
  component: {
    devServer: {
      framework: 'vue',
      bundler: 'vite',
    },
    experimentalFetchPolyfill: true,
  },
  e2e: {
    experimentalFetchPolyfill: true,
  },
  experimentalFetchPolyfill: true,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
        "import { defineConfig } from 'cypress';

        export default defineConfig({
          component: {
            devServer: {
              framework: 'vue',
              bundler: 'vite',
            },
          },
          e2e: {},
        });
        "
      `);
  });

  it('should handle cypress config files in projects using the "@nx/cypress:cypress" executor', async () => {
    addProjectConfiguration(tree, 'app1-e2e', {
      root: 'apps/app1-e2e',
      projectType: 'application',
      targets: {
        e2e: {
          executor: '@nx/cypress:cypress',
          options: {
            cypressConfig: 'apps/app1-e2e/cypress.custom-config.ts',
          },
        },
      },
    });
    tree.write(
      'apps/app1-e2e/cypress.custom-config.ts',
      `import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
import { defineConfig } from 'cypress';

export default defineConfig({
  ...nxE2EPreset(__filename, {
    cypressDir: 'src',
    bundler: 'vite',
    webServerCommands: {
      default: 'pnpm exec nx run app1:dev',
      production: 'pnpm exec nx run app1:dev',
    },
    ciWebServerCommand: 'pnpm exec nx run app1:dev',
    ciBaseUrl: 'http://localhost:4200',
  }),
  baseUrl: 'http://localhost:4200',
  experimentalFetchPolyfill: true,
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1-e2e/cypress.custom-config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { nxE2EPreset } from '@nx/cypress/plugins/cypress-preset';
      import { defineConfig } from 'cypress';

      export default defineConfig({
        ...nxE2EPreset(__filename, {
          cypressDir: 'src',
          bundler: 'vite',
          webServerCommands: {
            default: 'pnpm exec nx run app1:dev',
            production: 'pnpm exec nx run app1:dev',
          },
          ciWebServerCommand: 'pnpm exec nx run app1:dev',
          ciBaseUrl: 'http://localhost:4200',
        }),
        baseUrl: 'http://localhost:4200',
      });
      "
    `);
  });
});
