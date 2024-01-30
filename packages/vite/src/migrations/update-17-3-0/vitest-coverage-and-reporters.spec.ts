import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration } from '@nx/devkit';
import fixCoverageThreshold from './vitest-coverage-and-reporters';

describe('vitest-coverage-threshold migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should not do anything if no coverage', async () => {
    addProject1(tree, 'demo');
    await fixCoverageThreshold(tree);
    expect(tree.read('apps/demo/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should not do anything if coverage but no thresholds', async () => {
    addProject2(tree, 'demo2');
    await fixCoverageThreshold(tree);
    expect(tree.read('demo2/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should move thresholds in threshold object - has 2', async () => {
    addProject3(tree, 'demo3');
    await fixCoverageThreshold(tree);
    expect(tree.read('demo3/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should move thresholds in threshold object - has 3', async () => {
    addProject4(tree, 'demo4');
    await fixCoverageThreshold(tree);
    expect(tree.read('demo4/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });
  it('should move thresholds in threshold object - has all', async () => {
    addProject5(tree, 'demo5');
    await fixCoverageThreshold(tree);
    expect(tree.read('demo5/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should move thresholds in threshold object - has 1', async () => {
    addProject6(tree, 'demo6');
    await fixCoverageThreshold(tree);
    expect(tree.read('demo6/vite.config.ts', 'utf-8')).toMatchSnapshot();
  });
});

function addProject1(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `apps/${name}`,
    sourceRoot: `apps/${name}/src`,
    targets: {
      test: {
        executor: '@nx/vite:test',
        options: {},
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
      test: {
        executor: '@nx/vite:test',
        options: {},
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
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../coverage/${name}',
      provider: 'v8',
    },
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
      test: {
        executor: '@nx/vite:test',
        options: {},
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
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../coverage/${name}',
      provider: 'v8',
      lines: 100,
      statements: 100,
    },
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
      test: {
        executor: '@nx/vite:test',
        options: {},
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
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../coverage/${name}',
      provider: 'v8',
      lines: 100,
      statements: 100,
      branches: 75,
    },
  },
});
`
  );
}

function addProject5(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      test: {
        executor: '@nx/vite:test',
        options: {},
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
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../coverage/${name}',
      provider: 'v8',
      lines: 100,
      statements: 100,
      branches: 75,
      functions: 60,
    },
  },
});
`
  );
}
function addProject6(tree: Tree, name: string) {
  addProjectConfiguration(tree, name, {
    root: `${name}`,
    sourceRoot: `${name}/src`,
    targets: {
      test: {
        executor: '@nx/vite:test',
        options: {},
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
  test: {
    globals: true,
    cache: {
      dir: '../node_modules/.vitest',
    },
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    coverage: {
      reportsDirectory: '../coverage/${name}',
      provider: 'v8',
      branches: 75,
    },
  },
});
`
  );
}
