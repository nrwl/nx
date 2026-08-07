import { type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './use-import-meta-dirname';

const GENERATED_CONFIG = `import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/utils',
  test: {
    name: '@org/utils',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
`;

describe('use-import-meta-dirname migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('rewrites __dirname in a generated vitest config', async () => {
    tree.write('packages/utils/vitest.config.mts', GENERATED_CONFIG);

    await migration(tree);

    expect(tree.read('packages/utils/vitest.config.mts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vitest/config';

      export default defineConfig(() => ({
        root: import.meta.dirname,
        cacheDir: '../../node_modules/.vite/packages/utils',
        test: {
          name: '@org/utils',
          watch: false,
          globals: true,
          environment: 'node',
          include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          reporters: ['default'],
          coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8' as const,
          },
        },
      }));
      "
    `);
  });

  it('rewrites every __dirname reference in a vite config', async () => {
    tree.write(
      'packages/ui/vite.config.mts',
      `import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';

export default defineConfig(() => ({
  root: __dirname,
  plugins: [
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(__dirname, 'tsconfig.lib.json'),
    }),
  ],
}));
`
    );

    await migration(tree);

    expect(tree.read('packages/ui/vite.config.mts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { defineConfig } from 'vite';
      import dts from 'vite-plugin-dts';
      import * as path from 'path';

      export default defineConfig(() => ({
        root: import.meta.dirname,
        plugins: [
          dts({
            entryRoot: 'src',
            tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
          }),
        ],
      }));
      "
    `);
  });

  it('rewrites .mjs configs', async () => {
    tree.write(
      'packages/ui/vitest.config.mjs',
      `export default { root: __dirname };\n`
    );

    await migration(tree);

    expect(tree.read('packages/ui/vitest.config.mjs', 'utf-8')).toBe(
      `export default { root: import.meta.dirname };\n`
    );
  });

  it('leaves .ts and .js configs alone, since they can be loaded as CommonJS', async () => {
    const tsConfig = `export default { root: __dirname };\n`;
    tree.write('packages/ui/vite.config.ts', tsConfig);
    tree.write('packages/ui/vitest.config.js', tsConfig);

    await migration(tree);

    expect(tree.read('packages/ui/vite.config.ts', 'utf-8')).toBe(tsConfig);
    expect(tree.read('packages/ui/vitest.config.js', 'utf-8')).toBe(tsConfig);
  });

  it('leaves a config that declares its own __dirname alone', async () => {
    const config = `import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default { root: __dirname };
`;
    tree.write('packages/ui/vite.config.mts', config);

    await migration(tree);

    expect(tree.read('packages/ui/vite.config.mts', 'utf-8')).toBe(config);
  });

  it('leaves non-config files alone', async () => {
    const source = `export const root = __dirname;\n`;
    tree.write('packages/ui/src/other.mts', source);

    await migration(tree);

    expect(tree.read('packages/ui/src/other.mts', 'utf-8')).toBe(source);
  });

  it('is a no-op when run twice', async () => {
    tree.write('packages/utils/vitest.config.mts', GENERATED_CONFIG);

    await migration(tree);
    const afterFirstRun = tree.read(
      'packages/utils/vitest.config.mts',
      'utf-8'
    );
    await migration(tree);

    expect(tree.read('packages/utils/vitest.config.mts', 'utf-8')).toBe(
      afterFirstRun
    );
  });
});
