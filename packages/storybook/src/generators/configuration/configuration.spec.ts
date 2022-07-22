import {
  readJson,
  readProjectConfiguration,
  Tree,
  updateJson,
  writeJson,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { Linter } from '@nrwl/linter';
import { libraryGenerator } from '@nrwl/workspace/generators';
import { TsConfig } from '../../utils/utilities';
import configurationGenerator from './configuration';
import * as workspaceConfiguration from './test-configs/workspace-conifiguration.json';

describe('@nrwl/storybook:configuration', () => {
  describe('basic functionalities', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        standaloneConfig: false,
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-essentials': '~6.2.9',
          '@storybook/react': '~6.2.9',
        },
      });
    });

    it('should generate files', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      // Root
      expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
      expect(tree.exists('.storybook/main.js')).toBeTruthy();
      const rootStorybookTsconfigJson = readJson<TsConfig>(
        tree,
        '.storybook/tsconfig.json'
      );
      expect(rootStorybookTsconfigJson.extends).toBe('../tsconfig.base.json');
      expect(rootStorybookTsconfigJson.exclude).toEqual([
        '../**/*.spec.js',
        '../**/*.test.js',
        '../**/*.spec.ts',
        '../**/*.test.ts',
        '../**/*.spec.tsx',
        '../**/*.test.tsx',
        '../**/*.spec.jsx',
        '../**/*.test.jsx',
      ]);

      // Local
      expect(
        tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
      ).toBeTruthy();
      expect(tree.exists('libs/test-ui-lib/.storybook/main.js')).toBeTruthy();
      expect(
        tree.exists('libs/test-ui-lib/.storybook/preview.js')
      ).toBeTruthy();

      const storybookTsconfigJson = readJson<{ exclude: string[] }>(
        tree,
        'libs/test-ui-lib/.storybook/tsconfig.json'
      );

      expect(
        storybookTsconfigJson.exclude.includes('../**/*.spec.ts')
      ).toBeTruthy();
      expect(
        storybookTsconfigJson.exclude.includes('../**/*.spec.tsx')
      ).toBeFalsy();
      expect(
        storybookTsconfigJson.exclude.includes('../**/*.spec.js')
      ).toBeFalsy();
      expect(
        storybookTsconfigJson.exclude.includes('../**/*.spec.jsx')
      ).toBeFalsy();
    });

    it('should generate TypeScript Configuration files', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        tsConfiguration: true,
      });

      // Root
      expect(tree.exists('.storybook/tsconfig.json')).toBeTruthy();
      expect(tree.exists('.storybook/main.ts')).toBeTruthy();
      const rootStorybookTsconfigJson = readJson<TsConfig>(
        tree,
        '.storybook/tsconfig.json'
      );
      expect(rootStorybookTsconfigJson.extends).toBe('../tsconfig.base.json');

      // Local
      expect(
        tree.exists('libs/test-ui-lib/.storybook/tsconfig.json')
      ).toBeTruthy();
      expect(tree.exists('libs/test-ui-lib/.storybook/main.ts')).toBeTruthy();
      expect(
        tree.exists('libs/test-ui-lib/.storybook/preview.ts')
      ).toBeTruthy();
    });

    it('should extend from root tsconfig.json when no tsconfig.base.json', async () => {
      tree.rename('tsconfig.base.json', 'tsconfig.json');

      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      const rootStorybookTsconfigJson = readJson<TsConfig>(
        tree,
        '.storybook/tsconfig.json'
      );
      expect(rootStorybookTsconfigJson.extends).toBe('../tsconfig.json');
    });

    it('should generate a webpackFinal into the main.js and reference a potential global webpackFinal definition', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      expect(
        tree.read('libs/test-ui-lib/.storybook/main.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should reference the "old" webpack.config.js if there - for backwards compatibility', async () => {
      // create a root webpack.config.js as in "old" storybook workspaces
      tree.write('.storybook/webpack.config.js', 'export const test ="hi"');

      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      expect(
        tree.read('libs/test-ui-lib/.storybook/main.js', 'utf-8')
      ).toMatchSnapshot();
    });

    it('should not update root files after generating them once', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      const newContents = `module.exports = {
  stories: [],
  addons: ['@storybook/addon-essentials', 'new-addon'],
};
`;
      // Setup a new lib
      await libraryGenerator(tree, {
        name: 'test-ui-lib-2',
        standaloneConfig: false,
      });

      tree.write('.storybook/main.js', newContents);
      await configurationGenerator(tree, {
        name: 'test-ui-lib-2',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      expect(tree.read('.storybook/main.js', 'utf-8')).toEqual(newContents);
    });

    it('should update workspace file for react libs', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
      });
      const project = readProjectConfiguration(tree, 'test-ui-lib');

      expect(project.targets.storybook).toEqual({
        executor: '@nrwl/storybook:storybook',
        configurations: {
          ci: {
            quiet: true,
          },
        },
        options: {
          port: 4400,
          uiFramework: '@storybook/react',
          config: {
            configFolder: 'libs/test-ui-lib/.storybook',
          },
        },
      });

      expect(project.targets.lint).toEqual({
        executor: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/test-ui-lib/**/*.ts'],
        },
      });
    });

    it('should update workspace file for angular libs', async () => {
      // Setup a new lib
      await libraryGenerator(tree, {
        name: 'test-ui-lib-2',
        standaloneConfig: false,
      });
      await configurationGenerator(tree, {
        name: 'test-ui-lib-2',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });
      const project = readProjectConfiguration(tree, 'test-ui-lib-2');

      expect(project.targets.storybook).toEqual({
        executor: '@storybook/angular:start-storybook',
        configurations: {
          ci: {
            quiet: true,
          },
        },
        options: {
          port: 4400,
          browserTarget: 'test-ui-lib-2:build-storybook',
          compodoc: false,
          configDir: 'libs/test-ui-lib-2/.storybook',
        },
      });

      expect(project.targets.lint).toEqual({
        executor: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/test-ui-lib-2/**/*.ts'],
        },
      });
    });

    it('should update workspace file for angular buildable libs', async () => {
      // Setup a new lib
      await libraryGenerator(tree, {
        name: 'test-ui-lib-5',
        standaloneConfig: false,
        buildable: true,
      });
      await configurationGenerator(tree, {
        name: 'test-ui-lib-5',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });
      const project = readProjectConfiguration(tree, 'test-ui-lib-5');

      expect(project.targets.storybook).toEqual({
        executor: '@storybook/angular:start-storybook',
        configurations: {
          ci: {
            quiet: true,
          },
        },
        options: {
          port: 4400,
          browserTarget: 'test-ui-lib-5:build-storybook',
          compodoc: false,
          configDir: 'libs/test-ui-lib-5/.storybook',
        },
      });

      expect(project.targets.lint).toEqual({
        executor: '@nrwl/linter:eslint',
        outputs: ['{options.outputFile}'],
        options: {
          lintFilePatterns: ['libs/test-ui-lib-5/**/*.ts'],
        },
      });
    });

    it('should update `tsconfig.lib.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.lib.json'
      ) as Required<TsConfig>;

      expect(tsconfigJson.exclude).toContain('**/*.stories.ts');
      expect(tsconfigJson.exclude).toContain('**/*.stories.js');
      expect(tsconfigJson.exclude).toContain('**/*.stories.jsx');
      expect(tsconfigJson.exclude).toContain('**/*.stories.tsx');
    });

    it('should update `tsconfig.json` file', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'libs/test-ui-lib/tsconfig.json'
      );

      expect(tsconfigJson.references).toMatchInlineSnapshot(`
      Array [
        Object {
          "path": "./tsconfig.lib.json",
        },
        Object {
          "path": "./tsconfig.spec.json",
        },
        Object {
          "path": "./.storybook/tsconfig.json",
        },
      ]
    `);
    });

    it("should update the project's .eslintrc.json if config exists", async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        standaloneConfig: false,
      });

      updateJson(tree, 'libs/test-ui-lib2/.eslintrc.json', (json) => {
        json.parserOptions = {
          project: [],
        };
        return json;
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
      });

      expect(readJson(tree, 'libs/test-ui-lib2/.eslintrc.json').parserOptions)
        .toMatchInlineSnapshot(`
      Object {
        "project": Array [
          "libs/test-ui-lib2/.storybook/tsconfig.json",
        ],
      }
    `);
    });

    it('should have the proper typings', async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        standaloneConfig: false,
      });

      await configurationGenerator(tree, {
        name: 'test-ui-lib2',
        uiFramework: '@storybook/react',
        standaloneConfig: false,
      });

      expect(
        readJson(tree, 'libs/test-ui-lib2/.storybook/tsconfig.json').files
      ).toMatchSnapshot();
    });

    it('should generate TS config for project if root config is TS', async () => {
      await configurationGenerator(tree, {
        name: 'test-ui-lib',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
        tsConfiguration: true,
      });

      const newContents = `module.exports = {
  stories: [],
  addons: ['@storybook/addon-essentials', 'new-addon'],
};
`;
      // Setup a new lib
      await libraryGenerator(tree, {
        name: 'test-ui-lib-2',
        standaloneConfig: false,
      });

      tree.write('.storybook/main.ts', newContents);
      await configurationGenerator(tree, {
        name: 'test-ui-lib-2',
        uiFramework: '@storybook/angular',
        standaloneConfig: false,
      });

      expect(tree.read('.storybook/main.ts', 'utf-8')).toEqual(newContents);
      expect(tree.exists('libs/test-ui-lib-2/.storybook/main.ts')).toBeTruthy();
      expect(
        tree.exists('libs/test-ui-lib-2/.storybook/preview.ts')
      ).toBeTruthy();
      expect(tree.exists('libs/test-ui-lib-2/.storybook/main.js')).toBeFalsy();
      expect(
        tree.exists('libs/test-ui-lib-2/.storybook/preview.js')
      ).toBeFalsy();
    });
  });

  describe('for other types of projects - Next.js and the swc compiler', () => {
    describe('for js Storybook configurations', () => {
      let tree: Tree;
      beforeAll(async () => {
        tree = createTreeWithEmptyWorkspace();
        writeJson(tree, 'workspace.json', workspaceConfiguration);
        writeJson(tree, 'apps/nxapp/tsconfig.json', {});
        writeJson(tree, 'apps/reapp/tsconfig.json', {});
        writeJson(tree, 'libs/nxlib/tsconfig.json', {});
        writeJson(tree, 'libs/nxlib-buildable/tsconfig.json', {});
        writeJson(tree, 'libs/relib-buildable/tsconfig.json', {});
        writeJson(tree, 'apps/reapp-swc/tsconfig.json', {});
        await configurationGenerator(tree, {
          name: 'nxapp',
          uiFramework: '@storybook/react',
        });
        await configurationGenerator(tree, {
          name: 'reapp',
          uiFramework: '@storybook/react',
        });
        await configurationGenerator(tree, {
          name: 'nxlib',
          uiFramework: '@storybook/react',
        });
        await configurationGenerator(tree, {
          name: 'nxlib-buildable',
          uiFramework: '@storybook/react',
        });
        await configurationGenerator(tree, {
          name: 'relib-buildable',
          uiFramework: '@storybook/react',
        });
        await configurationGenerator(tree, {
          name: 'reapp-swc',
          uiFramework: '@storybook/react',
        });
      });

      it(`should create correct main.js and tsconfig.json for NextJs apps`, async () => {
        expect(
          tree.read('apps/nxapp/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/nxapp/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.js and tsconfig.json for React apps`, async () => {
        expect(
          tree.read('apps/reapp/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/reapp/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.js and tsconfig.json for NextJS libs`, async () => {
        expect(
          tree.read('libs/nxlib/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/nxlib/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.js and tsconfig.json for NextJS buildable libs`, async () => {
        expect(
          tree.read('libs/nxlib-buildable/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/nxlib-buildable/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.js and tsconfig.json for React buildable libs`, async () => {
        expect(
          tree.read('libs/relib-buildable/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/relib-buildable/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.js and tsconfig.json for React apps using the swc compiler`, async () => {
        expect(
          tree.read('apps/reapp-swc/.storybook/main.js', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/reapp-swc/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });
    });

    describe('for TypeScript Storybook configurations', () => {
      let tree: Tree;
      beforeAll(async () => {
        tree = createTreeWithEmptyWorkspace();
        writeJson(tree, 'workspace.json', workspaceConfiguration);
        writeJson(tree, 'apps/nxapp/tsconfig.json', {});
        writeJson(tree, 'apps/reapp/tsconfig.json', {});
        writeJson(tree, 'libs/nxlib/tsconfig.json', {});
        writeJson(tree, 'libs/nxlib-buildable/tsconfig.json', {});
        writeJson(tree, 'libs/relib-buildable/tsconfig.json', {});
        writeJson(tree, 'apps/reapp-swc/tsconfig.json', {});
        await configurationGenerator(tree, {
          name: 'nxapp',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
        await configurationGenerator(tree, {
          name: 'reapp',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
        await configurationGenerator(tree, {
          name: 'nxlib',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
        await configurationGenerator(tree, {
          name: 'nxlib-buildable',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
        await configurationGenerator(tree, {
          name: 'relib-buildable',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
        await configurationGenerator(tree, {
          name: 'reapp-swc',
          uiFramework: '@storybook/react',
          tsConfiguration: true,
        });
      });

      it(`should create correct main.ts and tsconfig.json for NextJs apps`, async () => {
        expect(
          tree.read('apps/nxapp/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/nxapp/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.ts and tsconfig.json for React apps`, async () => {
        expect(
          tree.read('apps/reapp/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/reapp/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.ts and tsconfig.json for NextJS libs`, async () => {
        expect(
          tree.read('libs/nxlib/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/nxlib/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.ts and tsconfig.json for NextJS buildable libs`, async () => {
        expect(
          tree.read('libs/nxlib-buildable/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/nxlib-buildable/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.ts and tsconfig.json for React buildable libs`, async () => {
        expect(
          tree.read('libs/relib-buildable/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('libs/relib-buildable/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });

      it(`should create correct main.ts and tsconfig.json for React apps using the swc compiler`, async () => {
        expect(
          tree.read('apps/reapp-swc/.storybook/main.ts', 'utf-8')
        ).toMatchSnapshot();

        expect(
          tree.read('apps/reapp-swc/.storybook/tsconfig.json', 'utf-8')
        ).toMatchSnapshot();
      });
    });
  });
});
