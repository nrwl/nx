import addIncludeToTsConfig from './add-include-tsconfig';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, addProjectConfiguration, writeJson } from '@nx/devkit';

jest.mock('@nuxt/kit', () => ({
  loadNuxtConfig: jest.fn().mockImplementation(() => {
    return Promise.resolve({
      buildDir: '../dist/my-nuxt-app/.nuxt',
    });
  }),
}));

jest.mock('../../utils/executor-utils', () => ({
  loadNuxtKitDynamicImport: jest.fn().mockResolvedValue({
    loadNuxtConfig: jest.fn().mockResolvedValue({
      buildDir: '../dist/my-nuxt-app/.nuxt',
    }),
  }),
}));

describe('addIncludeToTsConfig', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'my-nuxt-app', {
      root: `my-nuxt-app`,
      sourceRoot: `my-nuxt-app/src`,
      targets: {
        test: {
          executor: '@nx/vite:test',
          options: {},
        },
      },
    });

    tree.write(
      `my-nuxt-app/nuxt.config.ts`,
      `
      import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
      import { defineNuxtConfig } from 'nuxt/config';
      
      // https://nuxt.com/docs/api/configuration/nuxt-config
      export default defineNuxtConfig({
        workspaceDir: '../../',
        srcDir: 'src',
        buildDir: '../dist/my-nuxt-app/.nuxt',
        css: ['~/assets/css/styles.css'],
        vite: {
          plugins: [nxViteTsPaths()],
        },
      });
        `
    );

    writeJson(tree, 'my-nuxt-app/tsconfig.json', {
      compilerOptions: {},
      files: [],
      include: [],
      references: [
        {
          path: './tsconfig.app.json',
        },
        {
          path: './tsconfig.spec.json',
        },
      ],
      extends: '../tsconfig.base.json',
    });
  });

  it('should add include to tsconfig', async () => {
    await addIncludeToTsConfig(tree);
    const tsConfig = tree.read('my-nuxt-app/tsconfig.json', 'utf-8');
    const tsconfigJson = JSON.parse(tsConfig);
    expect(tsconfigJson.include).toMatchObject([
      '../dist/my-nuxt-app/.nuxt/nuxt.d.ts',
    ]);
  });
});
