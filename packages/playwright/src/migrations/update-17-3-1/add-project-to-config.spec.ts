import { Tree, addProjectConfiguration } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';

import update from './add-project-to-config';

describe('update-nx-next-dependency', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update playwright.config.ts', async () => {
    addProjectConfiguration(tree, 'acme', {
      root: 'acme',
    });

    tree.write(
      'acme/playwright.config.ts',
      `import { defineConfig } from '@playwright/test';
            import { nxE2EPreset } from '@nx/playwright/preset';

            import { workspaceRoot } from '@nx/devkit';

            const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';

            export default defineConfig({
                ...nxE2EPreset(__filename, { testDir: './src' }),
                /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
                use: {
                  baseURL,
                  /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
                  trace: 'on-first-retry',
                },
                /* Run your local dev server before starting the tests */
                webServer: {
                  command: 'npx nx serve acme',
                  url: 'http://localhost:4200',
                  reuseExistingServer: !process.env.CI,
                  cwd: workspaceRoot,
                }
              });
              `
    );
    await update(tree);

    const content = tree.read('acme/playwright.config.ts', 'utf-8');
    expect(content).toContain('projects: [');
    expect(content).toMatchSnapshot();
  });

  it('should not update playwright.config.ts if projects is already defined', async () => {
    addProjectConfiguration(tree, 'acme', {
      root: 'acme',
    });

    tree.write(
      'acme/playwright.config.ts',
      `import { defineConfig } from '@playwright/test';
              import { nxE2EPreset } from '@nx/playwright/preset';
  
              import { workspaceRoot } from '@nx/devkit';
  
              const baseURL = process.env['BASE_URL'] || 'http://localhost:4200';
  
              export default defineConfig({
                  ...nxE2EPreset(__filename, { testDir: './src' }),
                  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
                  use: {
                    baseURL,
                    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
                    trace: 'on-first-retry',
                  },
                  /* Run your local dev server before starting the tests */
                  webServer: {
                    command: 'npx nx serve acme',
                    url: 'http://localhost:4200',
                    reuseExistingServer: !process.env.CI,
                    cwd: workspaceRoot,
                  },
                  projects: []
                });
                `
    );
    await update(tree);
    expect(tree.read('acme/playwright.config.ts', 'utf-8')).toContain(
      'projects: []'
    );
    expect(tree.read('acme/playwright.config.ts', 'utf-8')).toMatchSnapshot();
  });
});
