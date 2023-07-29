export const noBuildOptions = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

    });
    `;

export const someBuildOptions = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

      build: {
        my: 'option',
      }

    });
    `;

export const noContentDefineConfig = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({});
    `;

export const conditionalConfig = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    export default defineConfig(({ command, mode, ssrBuild }) => {
      if (command === 'serve') {
        return {
          port: 4200,
          host: 'localhost',
        }
      } else {
        // command === 'build'
        return {
          my: 'option',
        }
      }
    })
    `;

export const configNoDefineConfig = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default {
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],
    };
    `;

export const noBuildOptionsHasTestOption = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        globals: true,
        cache: {
          dir: '../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },

    });
    `;

export const someBuildOptionsSomeTestOption = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';

    export default defineConfig({
      plugins: [
        react(),
        viteTsConfigPaths({
          root: '../../',
        }),
      ],

      test: {
        my: 'option',
      },

      build: {
        my: 'option',
      }

    });
    `;

export const hasEverything = `
    /// <reference types="vitest" />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import viteTsConfigPaths from 'vite-tsconfig-paths';
    import dts from 'vite-plugin-dts';
    import { joinPathFragments } from '@nx/devkit';

    export default defineConfig({
      plugins: [
        dts({
          entryRoot: 'src',
          tsConfigFilePath: joinPathFragments(__dirname, 'tsconfig.lib.json'),
          skipDiagnostics: true,
        }),
        react(),
        viteTsConfigPaths({
          root: '../../../',
        }),
      ],
    
      // Configuration for building your library.
      // See: https://vitejs.dev/guide/build.html#library-mode
      build: {
        lib: {
          // Could also be a dictionary or array of multiple entry points.
          entry: 'src/index.ts',
          name: 'pure-libs-react-vite',
          fileName: 'index',
          // Change this to the formats you want to support.
          // Don't forget to update your package.json as well.
          formats: ['es', 'cjs'],
        },
        rollupOptions: {
          // External packages that should not be bundled into your library.
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
      },
    
      test: {
        globals: true,
        cache: {
          dir: '../../../node_modules/.vitest',
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      },
    });
    `;

export const buildOption = `
    // Configuration for building your library.
    // See: https://vitejs.dev/guide/build.html#library-mode
    build: {
      lib: {
        // Could also be a dictionary or array of multiple entry points.
        entry: 'src/index.ts',
        name: 'my-app',
        fileName: 'index',
        // Change this to the formats you want to support.
        // Don't forget to update your package.json as well.
        formats: ['es', 'cjs']
      },
      rollupOptions: {
        // External packages that should not be bundled into your library.
        external: ["'react', 'react-dom', 'react/jsx-runtime'"]
      }
    },`;
export const buildOptionObject = {
  lib: {
    entry: 'src/index.ts',
    name: 'my-app',
    fileName: 'index',
    formats: ['es', 'cjs'],
  },
  rollupOptions: {
    external: ["'react', 'react-dom', 'react/jsx-runtime'"],
  },
};

export const testOption = `test: {
        globals: true,
        cache: {
          dir: '../node_modules/.vitest'
        },
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },`;

export const testOptionObject = {
  globals: true,
  cache: {
    dir: `../node_modules/.vitest`,
  },
  environment: 'jsdom',
  include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
};

export const dtsPlugin = `dts({
      entryRoot: 'src',
      tsConfigFilePath: joinPathFragments(__dirname, 'tsconfig.lib.json'),
      skipDiagnostics: true,
    }),`;
export const dtsImportLine = `import dts from 'vite-plugin-dts';\nimport { joinPathFragments } from '@nx/devkit';`;

export const pluginOption = `
    plugins: [
      ${dtsPlugin}
      react(),
      viteTsConfigPaths({
        root: '../../',
      }),
    ],
    `;
