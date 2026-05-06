import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import renameRollupOptionsToRolldownOptions from './rename-rollup-options-to-rolldown-options';

describe('rename-rollup-options-to-rolldown-options', () => {
  it('should rename build.rollupOptions to build.rolldownOptions', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'apps/app/vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['react'],
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },
});
`
    );

    await renameRollupOptionsToRolldownOptions(tree);

    expect(tree.read('apps/app/vite.config.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        build: {
          rolldownOptions: {
            external: ['react'],
            output: {
              manualChunks: {
                vendor: ['react', 'react-dom'],
              },
            },
          },
        },
      });
      "
    `);
  });

  it('should rename rollupOptions inside environments configs', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: 'src/client.ts',
        },
      },
    },
    ssr: {
      build: {
        rollupOptions: {
          input: 'src/server.ts',
        },
      },
    },
  },
});
`
    );

    await renameRollupOptionsToRolldownOptions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        environments: {
          client: {
            build: {
              rolldownOptions: {
                input: 'src/client.ts',
              },
            },
          },
          ssr: {
            build: {
              rolldownOptions: {
                input: 'src/server.ts',
              },
            },
          },
        },
      });
      "
    `);
  });

  it('should support .mts and .mjs config files', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.mts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { external: ['lodash'] } },
});
`
    );
    tree.write(
      'vite.config.mjs',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: { rollupOptions: { external: ['lodash'] } },
});
`
    );

    await renameRollupOptionsToRolldownOptions(tree);

    expect(tree.read('vite.config.mts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        build: { rolldownOptions: { external: ['lodash'] } },
      });
      "
    `);
    expect(tree.read('vite.config.mjs', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        build: { rolldownOptions: { external: ['lodash'] } },
      });
      "
    `);
  });

  it('should be a no-op when no rollupOptions present', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
  },
});
`
    );

    await renameRollupOptionsToRolldownOptions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        build: {
          outDir: 'dist',
        },
      });
      "
    `);
  });

  it('should be idempotent', async () => {
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      'vite.config.ts',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rolldownOptions: {
      external: ['react'],
    },
  },
});
`
    );

    await renameRollupOptionsToRolldownOptions(tree);
    await renameRollupOptionsToRolldownOptions(tree);

    expect(tree.read('vite.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';

      export default defineConfig({
        build: {
          rolldownOptions: {
            external: ['react'],
          },
        },
      });
      "
    `);
  });
});
