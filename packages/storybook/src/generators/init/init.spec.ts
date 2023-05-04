import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { storybookVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('@nx/storybook:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('dependencies for package.json', () => {
    it('should add angular related dependencies when using Angular as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/angular',
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/react-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/html-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/web-components-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/vue-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/vue3-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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
        { '@nx/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/svelte-webpack5',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nx/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nx/storybook']).toBeUndefined();
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

  describe('cacheable operations', () => {
    it('should add build-storybook to cacheable operations', async () => {
      await initGenerator(tree, {
        uiFramework: '@storybook/html-webpack5',
      });
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.tasksRunnerOptions.default.options.cacheableOperations
      ).toContain('build-storybook');
    });

    it('should add build-storybook to cacheable operations for web-components', async () => {
      await initGenerator(tree, {
        uiFramework: '@storybook/web-components-webpack5',
      });
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.tasksRunnerOptions.default.options.cacheableOperations
      ).toContain('build-storybook');
    });

    it('should add build-storybook to cacheable operations for vue', async () => {
      await initGenerator(tree, {
        uiFramework: '@storybook/vue-webpack5',
      });
      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.tasksRunnerOptions.default.options.cacheableOperations
      ).toContain('build-storybook');
    });

    it('should add build-storybook to cacheable operations for vue3', async () => {
      await initGenerator(tree, {
        uiFramework: '@storybook/vue3-webpack5',
      });
      const nxJson = readJson(tree, 'nx.json');
      expect(
        nxJson.tasksRunnerOptions.default.options.cacheableOperations
      ).toContain('build-storybook');
    });

    it('should not add any framework specific dependencies when no framework is specified', async () => {
      await initGenerator(tree, { uiFramework: undefined });

      // get the updated package.json
      const packageJson = readJson(tree, 'package.json');

      // check that only the following dependencies have been added
      expect(Object.keys(packageJson.devDependencies)).toEqual([
        '@nx/js',
        '@nx/storybook',
        '@storybook/addon-essentials',
        '@storybook/core-server',
        'prettier',
        'typescript',
      ]);
    });
  });

  describe('update root tsconfig.json', () => {
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
      await initGenerator(tree, {
        uiFramework: '@storybook/react-webpack5',
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
      await initGenerator(tree, {
        uiFramework: '@storybook/react-webpack5',
      });
      const tsconfig = readJson(tree, 'tsconfig.json');
      expect(tsconfig['ts-node'].otherSetting).toEqual('value');
      expect(tsconfig['ts-node'].compilerOptions.module).toEqual('commonjs');
      expect(tsconfig['ts-node'].compilerOptions.test).toEqual('my-test-value');
    });
  });
});
