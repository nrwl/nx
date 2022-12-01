import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { Tree, readProjectConfiguration } from '@nrwl/devkit';

import generator from './vitest-generator';
import { VitestGeneratorSchema } from './schema';
import { mockReactAppGenerator } from '../../utils/test-utils';

describe('vitest generator', () => {
  let appTree: Tree;
  const options: VitestGeneratorSchema = {
    project: 'my-test-react-app',
    uiFramework: 'react',
  };

  beforeEach(async () => {
    appTree = createTreeWithEmptyWorkspace();
    await mockReactAppGenerator(appTree);
  });

  it('Should add the test target', async () => {
    await generator(appTree, options);
    const config = readProjectConfiguration(appTree, 'my-test-react-app');
    expect(config.targets['test']).toMatchInlineSnapshot(`
      Object {
        "executor": "@nrwl/vite:test",
        "options": Object {
          "passWithNoTests": true,
        },
        "outputs": Array [
          "{workspaceRoot}/coverage/{projectRoot}",
        ],
      }
    `);
  });

  describe('tsconfig', () => {
    it('should add a tsconfig.spec.json file', async () => {
      await generator(appTree, options);
      const tsconfig = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.json')?.toString() ?? '{}'
      );
      expect(tsconfig.references).toMatchInlineSnapshot(`
              Array [
                Object {
                  "path": "./tsconfig.app.json",
                },
                Object {
                  "path": "./tsconfig.spec.json",
                },
              ]
          `);

      const tsconfigSpec = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.spec.json')?.toString() ??
          '{}'
      );
      expect(tsconfigSpec).toMatchInlineSnapshot(`
              Object {
                "compilerOptions": Object {
                  "outDir": "../../dist/out-tsc",
                  "types": Array [
                    "vitest/globals",
                    "node",
                  ],
                },
                "extends": "./tsconfig.json",
                "include": Array [
                  "vite.config.ts",
                  "**/*.test.ts",
                  "**/*.spec.ts",
                  "**/*.test.tsx",
                  "**/*.spec.tsx",
                  "**/*.test.js",
                  "**/*.spec.js",
                  "**/*.test.jsx",
                  "**/*.spec.jsx",
                  "**/*.d.ts",
                ],
              }
          `);
    });

    it('should add vitest/importMeta when inSourceTests is true', async () => {
      await generator(appTree, { ...options, inSourceTests: true });
      const tsconfig = JSON.parse(
        appTree.read('apps/my-test-react-app/tsconfig.app.json')?.toString() ??
          '{}'
      );
      expect(tsconfig.compilerOptions.types).toMatchInlineSnapshot(`
        Array [
          "vitest/importMeta",
        ]
      `);
    });
  });

  describe('vite.config', () => {
    it('should modify the vite.config.js file to include the test options', async () => {
      await generator(appTree, options);
      const viteConfig = appTree
        .read('apps/my-test-react-app/vite.config.ts')
        .toString();
      expect(viteConfig).toMatchInlineSnapshot(`
        "
        /// <reference types=\\"vitest\\" />
              import { defineConfig } from 'vite';
              import react from '@vitejs/plugin-react';
              import tsconfigPaths from 'vite-tsconfig-paths';
              
              
              export default defineConfig({
                
            server:{
              port: 4200,
              host: 'localhost',
            },
                plugins: [
                  
                  react(),
                  tsconfigPaths({
                    root: '../../',
                    projects: ['tsconfig.base.json'],
                  }),
                ],
                
                
                test: {
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            
          },
              });"
      `);
    });
  });

  describe('insourceTests', () => {
    it('should add the insourceSource option in the vite config', async () => {
      await generator(appTree, { ...options, inSourceTests: true });
      const viteConfig = appTree
        .read('apps/my-test-react-app/vite.config.ts')
        .toString();
      expect(viteConfig).toMatchInlineSnapshot(`
        "
        /// <reference types=\\"vitest\\" />
              import { defineConfig } from 'vite';
              import react from '@vitejs/plugin-react';
              import tsconfigPaths from 'vite-tsconfig-paths';
              
              
              export default defineConfig({
                
            server:{
              port: 4200,
              host: 'localhost',
            },
                plugins: [
                  
                  react(),
                  tsconfigPaths({
                    root: '../../',
                    projects: ['tsconfig.base.json'],
                  }),
                ],
                
                define: {
            'import.meta.vitest': undefined
          },
                test: {
            globals: true,
            environment: 'jsdom',
            include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
            includeSource: ['src/**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']
          },
              });"
      `);
    });
  });
});
