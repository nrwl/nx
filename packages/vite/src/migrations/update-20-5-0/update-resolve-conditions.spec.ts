import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import updateResolveConditions from './update-resolve-conditions';

describe('update-resolve-conditions', () => {
  it('should not update resolve conditions when resolve does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });

  it('should not update resolve conditions when conditions does not exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
      },
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
        },
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });

  it('should update resolve conditions when conditions exist', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
        conditions: ['browser', 'import', 'module'],
      },
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
          conditions: ['browser', 'import', 'module', 'development|production'],
        },
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });

  it('should handle backticks', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
        conditions: [\`browser\`, \`import\`, \`module\`],
      },
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
          conditions: ['browser', 'import', 'module', 'development|production'],
        },
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });

  it('should update resolve conditions when conditions exist and not produce duplicates', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
        conditions: ['module', 'browser', 'development|production'],
      },
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
          conditions: ['module', 'browser', 'development|production'],
        },
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });

  it('should be idempotent', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
        conditions: ['module', 'browser', 'development|production'],
      },
      plugins: [
        viteTsConfigPaths(),
      ],
    });
    `
    );
    await updateResolveConditions(tree);
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
          conditions: ['module', 'browser', 'development|production'],
        },
        plugins: [viteTsConfigPaths()],
      });
      "
    `);
  });
  it('should ignore remix', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import {defineConfig} from 'vite';
      import {vitePlugin as remix} from '@remix-run/dev';
    
    export default defineConfig({
      resolve: {
        alias: {
          '@app': 'src/app',
        },
        conditions: ['module', 'browser', 'development|production'],
      },
      plugins: [
        viteTsConfigPaths(),
        remix()
      ],
    });
    `
    );
    await updateResolveConditions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import { vitePlugin as remix } from '@remix-run/dev';

      export default defineConfig({
        resolve: {
          alias: {
            '@app': 'src/app',
          },
          conditions: ['module', 'browser', 'development|production'],
        },
        plugins: [viteTsConfigPaths(), remix()],
      });
      "
    `);
  });
});
