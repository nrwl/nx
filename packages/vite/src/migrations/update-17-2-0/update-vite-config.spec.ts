import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import {
  Tree,
  addProjectConfiguration,
  logger,
  readProjectConfiguration,
} from '@nx/devkit';

import updateBuildDir from './update-vite-config';
import { viteConfigFixture } from './lib/vite-config-with-additional-js.fixture';

describe('change-vite-ts-paths-plugin migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add build outDir to vite.config.ts', async () => {
    addProject1(tree, 'demo');
    await updateBuildDir(tree);
    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(
      readProjectConfiguration(tree, 'demo').targets.build.options.outputPath
    ).toBe('dist/apps/demo');
  });

  it('should add build outDir to vite.config.ts if build exists', async () => {
    addProject2(tree, 'demo2');
    await updateBuildDir(tree);
    expect(tree.read('demo2/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(
      readProjectConfiguration(tree, 'demo2').targets.build.options.outputPath
    ).toBe('dist/demo2');
  });

  it('should add file replacements to vite.config.ts', async () => {
    addProject3(tree, 'demo3');
    await updateBuildDir(tree);
    expect(tree.read('demo3/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(
      readProjectConfiguration(tree, 'demo3').targets.build.options.outputPath
    ).toBe('dist/demo3');
  });

  it('should convert the file correctly', async () => {
    addProject4(tree, 'demo4');
    await updateBuildDir(tree);
    expect(tree.read('demo4/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(
      readProjectConfiguration(tree, 'demo4').targets.build.options.outputPath
    ).toBe('dist/demo4');
  });

  it('should convert the file correctly', async () => {
    addProject4(tree, 'demo4');
    await updateBuildDir(tree);
    expect(tree.read('demo4/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(
      readProjectConfiguration(tree, 'demo4').targets.build.options.outputPath
    ).toBe('dist/demo4');
  });

  it('should show warning to the user if could not recognize config', async () => {
    jest.spyOn(logger, 'warn');
    addProject5(tree, 'demo5');
    await updateBuildDir(tree);
    expect(tree.read('demo5/vite.config.ts', 'utf-8')).toMatchSnapshot();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `Could not migrate your demo5/vite.config.ts file.`
      )
    );
  });

  it('should correctly migrate the vite config within the file and not other object literals', async () => {
    // ARRANGE
    addProject1(tree, 'demo');
    tree.write(`apps/demo/vite.config.ts`, viteConfigFixture);
    // ACT
    await updateBuildDir(tree);
    // ASSERT
    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });
});

function addProject1(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/apps/${name}`,
          buildLibsFromSource: false,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });

  tree.write(
    `apps/${name}/vite.config.ts`,
    `
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/${name}',
  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [
    react(),
    viteTsConfigPaths({ 
      root: '../../'
    })
  ],

  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [
  //    viteTsConfigPaths({
  //      root: '../../',
  //    }),
  //  ],
  // },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});

`
  );
}

function addProject2(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${name}`,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });

  tree.write(
    `${name}/vite.config.ts`,
    `
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/${name}',
  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [
    react(),
    viteTsConfigPaths({ 
      root: '../../'
    })
  ],

  build: {
    someProperty: 'someValue',
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});

`
  );
}

function addProject3(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${name}`,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
            fileReplacements: [
              {
                replace: `${name}/src/environments/environment.ts`,
                with: `${name}/src/environments/environment.prod.ts`,
              },
            ],
          },
        },
      },
    },
  });

  tree.write(
    `${name}/vite.config.ts`,
    `
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  cacheDir: '../../node_modules/.vite/${name}',
  server: {
    port: 4200,
    host: 'localhost',
  },

  preview: {
    port: 4300,
    host: 'localhost',
  },

  plugins: [
    react(),
    viteTsConfigPaths({ 
      root: '../../'
    })
  ],

  build: {
    someProperty: 'someValue',
  },

  test: {
    globals: true,
    cache: {
      dir: '../../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  },
});

`
  );
}

function addProject4(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${name}`,
          buildLibsFromSource: false,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });

  tree.write(
    `${name}/vite.config.ts`,
    `
    /// <reference types='vitest' />
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
    
    export default defineConfig(({ mode }) => {
      return {
        cacheDir: '../../node_modules/.vite/demo4',
        server: {
          port: 4200,
          host: 'localhost',
        },
    
        preview: {
          port: 4300,
          host: 'localhost',
        },
    
        plugins: [react(), nxViteTsPaths()],
    
        // Uncomment this if you are using workers.
        // worker: {
        //  plugins: [ nxViteTsPaths() ],
        // },
    
        test: {
          globals: true,
          cache: {
            dir: '../../node_modules/.vitest',
          },
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        },
      };
    });    
`
  );
}

function addProject5(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      build: {
        executor: '@nx/vite:build',
        outputs: ['{options.outputPath}'],
        defaultConfiguration: 'production',
        options: {
          outputPath: `dist/${name}`,
          buildLibsFromSource: false,
        },
        configurations: {
          development: {
            mode: 'development',
          },
          production: {
            mode: 'production',
          },
        },
      },
    },
  });

  tree.write(
    `${name}/vite.config.ts`,
    `
 // some invalid config   
`
  );
}
