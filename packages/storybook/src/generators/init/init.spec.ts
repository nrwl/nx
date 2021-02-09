import { addDependenciesToPackageJson, readJson, Tree } from '@nrwl/devkit';
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

      // general deps
      expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-knobs']
      ).toBeDefined();
      expect(packageJson.devDependencies['@types/webpack']).toBeDefined();

      // angular specific
      expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).toBeDefined();

      // react specific
      expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

      // generic html specific
      expect(packageJson.devDependencies['@storybook/html']).not.toBeDefined();
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
        packageJson.devDependencies['@storybook/addon-knobs']
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
    expect(packageJson.devDependencies['@storybook/addon-knobs']).toBeDefined();

    // react specific
    expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
    expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
    expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();

    // angular specific
    expect(packageJson.devDependencies['@storybook/angular']).not.toBeDefined();
    expect(packageJson.devDependencies['@angular/forms']).not.toBeDefined();

    // generic html specific
    expect(packageJson.devDependencies['@storybook/html']).toBeDefined();
  });

  it('should add build-storybook to cacheable operations', async () => {
    await initGenerator(tree, {
      uiFramework: '@storybook/html',
    });
    const nxJson = readJson(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });
});
