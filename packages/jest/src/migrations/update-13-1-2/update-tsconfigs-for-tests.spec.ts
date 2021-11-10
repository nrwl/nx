import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import update from './update-tsconfigs-for-tests';

const reactTsConfigs = {
  app: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      types: ['node'],
    },
    files: [
      '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
      '../../node_modules/@nrwl/react/typings/image.d.ts',
    ],
    exclude: [
      '**/*.spec.ts',
      '**/*_spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
    ],
    include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
  },
  lib: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      types: ['node'],
    },
    files: [
      '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
      '../../node_modules/@nrwl/react/typings/image.d.ts',
    ],
    exclude: [
      '**/*.spec.ts',
      '**/*_spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
    ],
    include: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
  },
  spec: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      module: 'commonjs',
      types: ['jest', 'node'],
    },
    include: [
      '**/*.spec.ts',
      '**/*_spec.ts',
      '**/*.spec.tsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
      '**/*.d.ts',
    ],
    files: [
      '../../node_modules/@nrwl/react/typings/cssmodule.d.ts',
      '../../node_modules/@nrwl/react/typings/image.d.ts',
    ],
  },
  base: {
    include: [],
    files: [],
    references: [
      {
        path: './tsconfig.app.json',
      },
      {
        path: './tsconfig.lib.json',
      },
      {
        path: './tsconfig.spec.json',
      },
    ],
  },
  expectedFilesToContain: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*_spec.ts',
    '**/*_test.ts',
    '**/*.spec.tsx',
    '**/*.test.tsx',
    '**/*.spec.js',
    '**/*.test.js',
    '**/*.spec.jsx',
    '**/*.test.jsx',
  ],
};
const angularTsConfigs = {
  app: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      types: [],
    },
    files: ['src/main.ts', 'src/polyfills.ts'],
    include: ['src/**/*.d.ts'],
    exclude: ['**/*.spec.ts', '**/*_spec.ts'],
  },
  lib: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      target: 'es2015',
      declaration: true,
      declarationMap: true,
      inlineSources: true,
      types: [],
      lib: ['dom', 'es2018'],
    },
    exclude: ['src/test-setup.ts', '**/*.spec.ts'],
    include: ['**/*.ts'],
  },
  spec: {
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: '../../dist/out-tsc',
      module: 'commonjs',
      types: ['jest', 'node'],
    },
    files: ['src/test-setup.ts'],
    include: ['**/*.spec.ts', '**/*_spec.ts', '**/*.d.ts'],
  },
  expectedFilesToContain: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*_spec.ts',
    '**/*_test.ts',
  ],
};

const tsConfigLibBase = {
  include: [],
  files: [],
  references: [
    {
      path: './tsconfig.lib.json',
    },
    {
      path: './tsconfig.spec.json',
    },
  ],
};
const tsConfigAppBase = {
  include: [],
  files: [],
  references: [
    {
      path: './tsconfig.app.json',
    },
    {
      path: './tsconfig.spec.json',
    },
  ],
};

[
  // test TSX/JSX support
  { name: 'React App', configs: reactTsConfigs },
  // test non TSX/JSX support
  { name: 'Angular App', configs: angularTsConfigs },
].forEach(({ name, configs }) => {
  describe(`Jest Migration (v13.1.2): ${name}`, () => {
    let tree: Tree;

    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      tree.write(
        'apps/project-one/tsconfig.app.json',
        String.raw`${JSON.stringify(configs.app, null, 2)}`
      );
      tree.write(
        'apps/project-one/tsconfig.spec.json',
        String.raw`${JSON.stringify(configs.spec, null, 2)}`
      );
      tree.write(
        `apps/project-one/tsconfig.json`,
        String.raw`${JSON.stringify(tsConfigAppBase, null, 2)}`
      );
      tree.write(
        'libs/lib-one/tsconfig.lib.json',
        String.raw`${JSON.stringify(configs.lib, null, 2)}`
      );
      tree.write(
        'libs/lib-one/tsconfig.spec.json',
        String.raw`${JSON.stringify(configs.spec, null, 2)}`
      );
      tree.write(
        `libs/lib-one/tsconfig.json`,
        String.raw`${JSON.stringify(tsConfigLibBase, null, 2)}`
      );

      addProjectConfiguration(tree, 'lib-one', {
        root: 'libs/lib-one',
        sourceRoot: 'libs/lib-one/src',
        projectType: 'library',
        targets: {
          build: {
            executor: '@nrwl/web:build',
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'libs/lib-one/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
      });
      addProjectConfiguration(tree, 'project-one', {
        root: 'apps/project-one',
        sourceRoot: 'apps/project-one/src',
        projectType: 'application',
        targets: {
          build: {
            executor: '@nrwl/web:build',
          },
          test: {
            executor: '@nrwl/jest:jest',
            options: {
              jestConfig: 'apps/project-one/jest.config.js',
              passWithNoTests: true,
            },
          },
        },
      });
    });

    it('should update tsconfig.spec.json to include .test. files', async () => {
      await update(tree);
      const tsAppSpecConfig = JSON.parse(
        tree.read('apps/project-one/tsconfig.spec.json', 'utf-8')
      );
      const tsLibSpecConfig = JSON.parse(
        tree.read('apps/project-one/tsconfig.spec.json', 'utf-8')
      );

      expect(tsAppSpecConfig.include).toEqual(
        expect.arrayContaining(configs.expectedFilesToContain)
      );

      expect(tsLibSpecConfig.include).toEqual(
        expect.arrayContaining(configs.expectedFilesToContain)
      );
    });

    it('should update tsconfig.{lib|app}.json to exclude .test. files', async () => {
      await update(tree);
      const tsAppConfig = JSON.parse(
        tree.read('apps/project-one/tsconfig.app.json', 'utf-8')
      );
      const tsLibConfig = JSON.parse(
        tree.read('apps/project-one/tsconfig.app.json', 'utf-8')
      );

      expect(tsAppConfig.exclude).toEqual(
        expect.arrayContaining(configs.expectedFilesToContain)
      );
      expect(tsLibConfig.exclude).toEqual(
        expect.arrayContaining(configs.expectedFilesToContain)
      );
    });
  });
});
