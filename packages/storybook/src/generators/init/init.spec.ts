import {
  addDependenciesToPackageJson,
  NxJsonConfiguration,
  readJson,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import { storybookVersion } from '../../utils/versions';
import { initGenerator } from './init';

describe('@nrwl/storybook:init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  describe('dependencies for package.json', () => {
    it('should add angular related dependencies when using Angular as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/angular',
      });
      const packageJson = readJson(tree, 'package.json');

      expect(packageJson).toMatchSnapshot();

      // general deps
      expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
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
      expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

      // generic html specific
      expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte']
      ).not.toBeDefined();
    });

    it('should add react related dependencies when using React as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      addDependenciesToPackageJson(
        tree,
        { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
        { [existing]: existingVersion }
      );
      await initGenerator(tree, {
        uiFramework: '@storybook/react',
      });
      const packageJson = readJson(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-essentials']
      ).toBeDefined();

      // react specific
      expect(packageJson.devDependencies['@storybook/react']).toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).toBeDefined();

      // angular specific
      expect(
        packageJson.devDependencies['@storybook/angular']
      ).not.toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

      // generic html specific
      expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

      // generic svelte specific
      expect(
        packageJson.devDependencies['@storybook/svelte']
      ).not.toBeDefined();
    });
  });

  it('should add html related dependencies when using html as uiFramework', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {
      uiFramework: '@storybook/html',
    });
    const packageJson = readJson(tree, 'package.json');

    // general deps
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-essentials']
    ).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).toBeDefined();

    // generic svelte specific
    expect(packageJson.devDependencies['@storybook/svelte']).not.toBeDefined();
  });

  it('should add web-components related dependencies when using html as uiFramework', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {
      uiFramework: '@storybook/web-components',
    });
    const packageJson = readJson(tree, 'package.json');

    // general deps
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-essentials']
    ).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

    // generic web-components specific
    expect(
      packageJson.devDependencies['@storybook/web-components']
    ).toBeDefined();

    // generic vue specific
    expect(packageJson.devDependencies['@storybook/vue']).not.toBeDefined();

    // generic svelte specific
    expect(packageJson.devDependencies['@storybook/svelte']).not.toBeDefined();
  });

  it('should add vue related dependencies when using vue as uiFramework', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {
      uiFramework: '@storybook/vue',
    });
    const packageJson = readJson(tree, 'package.json');

    // general deps
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-essentials']
    ).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

    // generic web-components specific
    expect(
      packageJson.devDependencies['@storybook/web-components']
    ).not.toBeDefined();

    // generic svelte specific
    expect(packageJson.devDependencies['@storybook/svelte']).not.toBeDefined();

    // generic vue specific
    expect(packageJson.devDependencies['@storybook/vue']).toBeDefined();
  });

  it('should add vue3 related dependencies when using vue3 as uiFramework', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {
      uiFramework: '@storybook/vue3',
    });
    const packageJson = readJson(tree, 'package.json');

    // general deps
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-essentials']
    ).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

    // generic vue specific
    expect(packageJson.devDependencies['@storybook/vue']).not.toBeDefined();

    // generic web-components specific
    expect(
      packageJson.devDependencies['@storybook/web-components']
    ).not.toBeDefined();

    // generic svelte specific
    expect(packageJson.devDependencies['@storybook/svelte']).not.toBeDefined();

    // generic vue3 specific
    expect(packageJson.devDependencies['@storybook/vue3']).toBeDefined();
  });

  it('should add svelte related dependencies when using svelte as uiFramework', async () => {
    const existing = 'existing';
    const existingVersion = '1.0.0';
    addDependenciesToPackageJson(
      tree,
      { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
      { [existing]: existingVersion }
    );
    await initGenerator(tree, {
      uiFramework: '@storybook/svelte',
    });
    const packageJson = readJson(tree, 'package.json');

    // general deps
    expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
    expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
    expect(packageJson.dependencies[existing]).toBeDefined();
    expect(packageJson.devDependencies[existing]).toBeDefined();
    expect(
      packageJson.devDependencies['@storybook/addon-essentials']
    ).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();

    // generic vue specific
    expect(packageJson.devDependencies['@storybook/vue']).not.toBeDefined();

    // generic web-components specific
    expect(
      packageJson.devDependencies['@storybook/web-components']
    ).not.toBeDefined();

    // generic vue3 specific
    expect(packageJson.devDependencies['@storybook/vue3']).not.toBeDefined();

    // generic svelte specific
    expect(packageJson.devDependencies['@storybook/svelte']).toBeDefined();
  });

  it('should add build-storybook to cacheable operations', async () => {
    await initGenerator(tree, {
      uiFramework: '@storybook/html',
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });

  it('should add build-storybook to cacheable operations for web-components', async () => {
    await initGenerator(tree, {
      uiFramework: '@storybook/web-components',
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });

  it('should add build-storybook to cacheable operations for vue', async () => {
    await initGenerator(tree, {
      uiFramework: '@storybook/vue',
    });
    const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });

  it('should add build-storybook to cacheable operations for vue3', async () => {
    await initGenerator(tree, {
      uiFramework: '@storybook/vue3',
    });
    const nxJson = readJson(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });
});
