import {
  addDependenciesToPackageJson,
  addProjectConfiguration,
  NxJsonConfiguration,
  ProjectConfiguration,
  readJson,
  Tree,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/js';
import { TsConfig } from '../../utils/utilities';
import { nxVersion, storybookVersion } from '../../utils/versions';
import configurationGenerator from './configuration';
import * as variousProjects from './test-configs/various-projects.json';

// nested code imports graph from the repo, which might have innacurate graph version
jest.mock('nx/src/project-graph/project-graph', () => ({
  ...jest.requireActual<any>('nx/src/project-graph/project-graph'),
  createProjectGraphAsync: jest
    .fn()
    .mockImplementation(async () => ({ nodes: {}, dependencies: {} })),
}));

describe('@nx/storybook:configuration for Storybook v7', () => {
  describe('dependencies', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        bundler: 'none',
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
        addPlugin: true,
      });

      jest.resetModules();
      jest.doMock('@storybook/core-server/package.json', () => ({
        version: storybookVersion,
      }));
    });

    it('should add angular related dependencies when using Angular as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        standaloneConfig: false,
        uiFramework: '@storybook/angular',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson).toMatchSnapshot();
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/core-server']
      ).toBeDefined();
      // angular specific
      expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
    });

    it('should add react related dependencies when using React as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
    });

    it('should add html related dependencies when using html as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/html-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
    });

    it('should add web-components related dependencies when using html as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/web-components-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic web-components specific
      expect(
        packageJson.devDependencies['@storybook/web-components-webpack5']
      ).toBeDefined();
      // generic vue specific
      expect(
        packageJson.devDependencies['@storybook/vue-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
    });

    it('should add vue related dependencies when using vue as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/vue-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic web-components specific
      expect(
        packageJson.devDependencies['@storybook/web-components-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
      // generic vue specific
      expect(
        packageJson.devDependencies['@storybook/vue-webpack5']
      ).toBeDefined();
    });

    it('should add vue3 related dependencies when using vue3 as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/vue3-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic vue specific
      expect(
        packageJson.devDependencies['@storybook/vue-webpack5']
      ).not.toBeDefined();
      // generic web-components specific
      expect(
        packageJson.devDependencies['@storybook/web-components-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).not.toBeDefined();
      // generic vue3 specific
      expect(
        packageJson.devDependencies['@storybook/vue3-webpack5']
      ).toBeDefined();
    });

    it('should add svelte related dependencies when using svelte as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': nxVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        uiFramework: '@storybook/svelte-webpack5',
        addPlugin: true,
      });

      const packageJson = readJson(tree, 'package.json');
      // general deps
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();
      // react specific
      expect(
        packageJson.devDependencies['@storybook/react-webpack5']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();
      // generic html specific
      expect(
        packageJson.devDependencies['@storybook/html-webpack5']
      ).not.toBeDefined();
      // generic vue specific
      expect(
        packageJson.devDependencies['@storybook/vue-webpack5']
      ).not.toBeDefined();
      // generic web-components specific
      expect(
        packageJson.devDependencies['@storybook/web-components-webpack5']
      ).not.toBeDefined();
      // generic vue3 specific
      expect(
        packageJson.devDependencies['@storybook/vue3-webpack5']
      ).not.toBeDefined();
      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte-webpack5']
      ).toBeDefined();
    });
  });

  describe('basic functionalities', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.namedInputs = {
          production: ['default'],
        };
        return json;
      });
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        bundler: 'none',
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });
      writeJson(tree, 'package.json', {
        devDependencies: {
          '@storybook/addon-essentials': storybookVersion,
          '@storybook/react': storybookVersion,
          '@storybook/core-server': storybookVersion,
        },
      });

      jest.resetModules();
      jest.doMock('@storybook/core-server/package.json', () => ({
        version: storybookVersion,
      }));
    });

    it('should generate TypeScript Configuration files by default', async () => {
      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        standaloneConfig: false,
        uiFramework: '@storybook/angular',
        addPlugin: true,
      });

      expect(tree.exists('test-ui-lib/tsconfig.storybook.json')).toBeFalsy();
      expect(
        tree.read('test-ui-lib/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('test-ui-lib/.storybook/preview.ts')).toBeTruthy();
    });

    it('should update `tsconfig.lib.json` file', async () => {
      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        standaloneConfig: false,
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'test-ui-lib/tsconfig.lib.json'
      ) as Required<TsConfig>;

      expect(tsconfigJson.exclude).toContain('**/*.stories.ts');
      expect(tsconfigJson.exclude).toContain('**/*.stories.js');
      expect(tsconfigJson.exclude).toContain('**/*.stories.jsx');
      expect(tsconfigJson.exclude).toContain('**/*.stories.tsx');
    });

    it('should update `tsconfig.json` file', async () => {
      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        standaloneConfig: false,
        uiFramework: '@storybook/react-webpack5',
      });
      const tsconfigJson = readJson<TsConfig>(
        tree,
        'test-ui-lib/tsconfig.json'
      );

      expect(tsconfigJson.references).toMatchInlineSnapshot(`
        [
          {
            "path": "./tsconfig.lib.json",
          },
          {
            "path": "./tsconfig.spec.json",
          },
          {
            "path": "./tsconfig.storybook.json",
          },
        ]
      `);
    });

    it("should update the project's .eslintrc.json if config exists", async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      updateJson(tree, 'test-ui-lib2/.eslintrc.json', (json) => {
        json.parserOptions = {
          project: [],
        };
        return json;
      });

      await configurationGenerator(tree, {
        project: 'test-ui-lib2',
        standaloneConfig: false,
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      expect(readJson(tree, 'test-ui-lib2/.eslintrc.json').parserOptions)
        .toMatchInlineSnapshot(`
        {
          "project": [
            "test-ui-lib2/tsconfig.storybook.json",
          ],
        }
      `);
    });

    it('should have the proper typings', async () => {
      await libraryGenerator(tree, {
        name: 'test-ui-lib2',
        linter: Linter.EsLint,
        projectNameAndRootFormat: 'as-provided',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'test-ui-lib2',
        standaloneConfig: false,
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      expect(
        tree.read('test-ui-lib2/tsconfig.storybook.json', 'utf-8')
      ).toMatchSnapshot();

      expect(
        readJson(tree, 'package.json').devDependencies['core-js']
      ).toBeTruthy();
    });

    it('should generate TS config for project by default', async () => {
      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        standaloneConfig: false,
        uiFramework: '@storybook/angular',
        addPlugin: true,
      });

      expect(
        tree.read('test-ui-lib/.storybook/main.ts', 'utf-8')
      ).toMatchSnapshot();
      expect(tree.exists('test-ui-lib/.storybook/preview.ts')).toBeTruthy();
      expect(tree.exists('test-ui-lib/.storybook/main.js')).toBeFalsy();
      expect(tree.exists('test-ui-lib/.storybook/preview.js')).toBeFalsy();
    });

    it('should add test-storybook target', async () => {
      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        interactionTests: true,
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/test-runner']
      ).toBeTruthy();

      expect(
        readJson(tree, 'package.json').devDependencies['core-js']
      ).toBeTruthy();

      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/testing-library'
        ]
      ).toBeTruthy();

      expect(
        readJson(tree, 'package.json').devDependencies['@storybook/jest']
      ).toBeTruthy();

      expect(
        readJson(tree, 'package.json').devDependencies[
          '@storybook/addon-interactions'
        ]
      ).toBeTruthy();
    });
  });

  describe('update root tsconfig.json', () => {
    let tree: Tree;

    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      await libraryGenerator(tree, {
        name: 'test-ui-lib',
        bundler: 'none',
        projectNameAndRootFormat: 'as-provided',
        skipFormat: true,
        addPlugin: true,
      });

      jest.resetModules();
      jest.doMock('@storybook/core-server/package.json', () => ({
        version: storybookVersion,
      }));
    });

    it('should set the tsnode module to commonjs if there is a root tsconfig.json', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify({
          extends: './tsconfig.base.json',
          compilerOptions: {
            jsx: 'react-jsx',
            allowJs: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            forceConsistentCasingInFileNames: true,
            strict: true,
            noImplicitOverride: true,
            noPropertyAccessFromIndexSignature: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
          },
          files: [],
          include: [],
          references: [
            {
              path: './tsconfig.app.json',
            },
            {
              path: './.storybook/tsconfig.json',
            },
          ],
        })
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'tsconfig.json');
      expect(tsconfig['ts-node'].compilerOptions.module).toEqual('commonjs');
    });

    it('should set the tsnode module to commonjs and respect other tsnode settings', async () => {
      tree.write(
        'tsconfig.json',
        JSON.stringify({
          extends: './tsconfig.base.json',
          compilerOptions: {
            jsx: 'react-jsx',
            allowJs: true,
            esModuleInterop: true,
            allowSyntheticDefaultImports: true,
            forceConsistentCasingInFileNames: true,
            strict: true,
            noImplicitOverride: true,
            noPropertyAccessFromIndexSignature: true,
            noImplicitReturns: true,
            noFallthroughCasesInSwitch: true,
          },
          files: [],
          include: [],
          'ts-node': {
            otherSetting: 'value',
            compilerOptions: {
              test: 'my-test-value',
              module: 'my-module-value',
            },
          },
        })
      );

      await configurationGenerator(tree, {
        project: 'test-ui-lib',
        addPlugin: true,
      });

      const tsconfig = readJson(tree, 'tsconfig.json');
      expect(tsconfig['ts-node'].otherSetting).toEqual('value');
      expect(tsconfig['ts-node'].compilerOptions.module).toEqual('commonjs');
      expect(tsconfig['ts-node'].compilerOptions.test).toEqual('my-test-value');
    });
  });

  describe('generate Storybook configuration for all types of projects', () => {
    let tree: Tree;
    let testCases: string[][] = [];

    for (const [name, project] of Object.entries(variousProjects)) {
      testCases.push([
        `${
          project.projectType === 'application' ? 'apps' : 'libs'
        }/${name}/.storybook/`,
      ]);
    }

    beforeAll(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      for (const [name, project] of Object.entries(variousProjects)) {
        addProjectConfiguration(tree, name, project as ProjectConfiguration);
        writeJson(
          tree,
          `${
            project.projectType === 'application' ? 'apps' : 'libs'
          }/${name}/tsconfig.json`,
          {}
        );
      }

      tree.write('libs/react-vite/vite.config.ts', 'export default {}');
      tree.write('apps/main-vite/vite.config.ts', 'export default {}');
      tree.write('apps/main-vite-ts/vite.config.ts', 'export default {}');
      tree.write('apps/reapp/vite.config.ts', 'export default {}');
      tree.write('apps/wv1/vite.config.ts', 'export default {}');
      tree.write('apps/nextapp/next.config.js', 'export default {}');

      await configurationGenerator(tree, {
        project: 'reapp',
        tsConfiguration: false,
        uiFramework: '@storybook/react-vite',
        addPlugin: true,
      });
      await configurationGenerator(tree, {
        project: 'main-vite',
        tsConfiguration: false,
        uiFramework: '@storybook/react-vite',
        addPlugin: true,
      });
      await configurationGenerator(tree, {
        project: 'main-vite-ts',
        uiFramework: '@storybook/react-vite',
        addPlugin: true,
      });
      await configurationGenerator(tree, {
        project: 'main-webpack',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });
      await configurationGenerator(tree, {
        project: 'reappw',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });
      await configurationGenerator(tree, {
        project: 'react-rollup',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'react-vite',
        uiFramework: '@storybook/react-vite',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'nextapp',
        uiFramework: '@storybook/nextjs',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'react-swc',
        uiFramework: '@storybook/react-webpack5',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'wv1',
        uiFramework: '@storybook/web-components-vite',
        addPlugin: true,
      });

      await configurationGenerator(tree, {
        project: 'ww1',
        uiFramework: '@storybook/web-components-webpack5',
        addPlugin: true,
      });
    });

    test.each(testCases)(
      'should contain the correct configuration in %p',
      (storybookConfigPath) => {
        if (tree.exists(storybookConfigPath)) {
          if (tree.exists(`${storybookConfigPath}main.ts`)) {
            expect(
              tree.read(`${storybookConfigPath}main.ts`, 'utf-8')
            ).toMatchSnapshot();
          }
          if (tree.exists(`${storybookConfigPath}main.js`)) {
            expect(
              tree.read(`${storybookConfigPath}main.js`, 'utf-8')
            ).toMatchSnapshot();
          }
          expect(
            tree.read(`${storybookConfigPath}tsconfig.json`, 'utf-8')
          ).toMatchSnapshot();
        }
      }
    );
  });
});
