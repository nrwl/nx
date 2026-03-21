import { stripIndents, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import addNxTsPlugin from './add-nx-ts-plugin';

jest.mock('@nx/js/src/utils/typescript/ts-solution-setup', () => ({
  isUsingTsSolutionSetup: jest.fn(),
}));

import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

describe('add-nx-ts-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(true);
  });

  it('should add nxTsPlugin to vite config in TS solution setup', async () => {
    tree.write(
      'apps/my-app/vite.config.mts',
      stripIndents`
      import { defineConfig } from 'vite';
      import react from '@vitejs/plugin-react';

      export default defineConfig(() => ({
        plugins: [react()],
      }));`
    );

    await addNxTsPlugin(tree);

    const content = tree.read('apps/my-app/vite.config.mts', 'utf-8');
    expect(content).toContain(
      `import { nxTsPlugin } from '@nx/vite/plugins/nx-ts.plugin'`
    );
    expect(content).toContain('nxTsPlugin()');
  });

  it('should skip if nxTsPlugin already present', async () => {
    const original = stripIndents`
      import { defineConfig } from 'vite';
      import { nxTsPlugin } from '@nx/vite/plugins/nx-ts.plugin';

      export default defineConfig(() => ({
        plugins: [nxTsPlugin()],
      }));`;

    tree.write('apps/my-app/vite.config.mts', original);

    await addNxTsPlugin(tree);

    const content = tree.read('apps/my-app/vite.config.mts', 'utf-8');
    // Should not duplicate
    expect(content.match(/nxTsPlugin/g).length).toBe(2); // import + usage
  });

  it('should skip if nxViteTsPaths is present', async () => {
    const original = stripIndents`
      import { defineConfig } from 'vite';
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

      export default defineConfig(() => ({
        plugins: [nxViteTsPaths()],
      }));`;

    tree.write('apps/my-app/vite.config.mts', original);

    await addNxTsPlugin(tree);

    const content = tree.read('apps/my-app/vite.config.mts', 'utf-8');
    expect(content).not.toContain('nxTsPlugin');
  });

  it('should skip in non-TS-solution setups', async () => {
    (isUsingTsSolutionSetup as jest.Mock).mockReturnValue(false);

    tree.write(
      'apps/my-app/vite.config.mts',
      stripIndents`
      import { defineConfig } from 'vite';

      export default defineConfig(() => ({
        plugins: [],
      }));`
    );

    await addNxTsPlugin(tree);

    const content = tree.read('apps/my-app/vite.config.mts', 'utf-8');
    expect(content).not.toContain('nxTsPlugin');
  });

  it('should handle vitest config files', async () => {
    tree.write(
      'apps/my-app/vitest.config.mts',
      stripIndents`
      import { defineConfig } from 'vitest/config';

      export default defineConfig(() => ({
        plugins: [],
      }));`
    );

    await addNxTsPlugin(tree);

    const content = tree.read('apps/my-app/vitest.config.mts', 'utf-8');
    expect(content).toContain(
      `import { nxTsPlugin } from '@nx/vite/plugins/nx-ts.plugin'`
    );
    expect(content).toContain('nxTsPlugin()');
  });
});
