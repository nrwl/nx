import { Tree } from '@angular-devkit/schematics';

import { addDepsToPackageJson, NxJson, readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';

import { callRule, runSchematic } from '../../utils/testing';
import { storybookVersion } from '../../utils/versions';

describe('init', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
  });

  describe('dependencies for package.json', () => {
    it('should add angular related dependencies when using Angular as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      await callRule(
        addDepsToPackageJson(
          { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
          { [existing]: existingVersion },
          false
        ),
        appTree
      );
      const tree = await runSchematic(
        'init',
        {
          uiFramework: '@storybook/angular',
        },
        appTree
      );
      const packageJson = readJsonInTree(tree, 'package.json');

      // general deps
      expect(packageJson.devDependencies['@nrwl/storybook']).toBeDefined();
      expect(packageJson.dependencies['@nrwl/storybook']).toBeUndefined();
      expect(packageJson.dependencies[existing]).toBeDefined();
      expect(packageJson.devDependencies[existing]).toBeDefined();
      expect(
        packageJson.devDependencies['@storybook/addon-knobs']
      ).toBeDefined();

      // angular specific
      expect(packageJson.devDependencies['@storybook/angular']).toBeDefined();
      expect(packageJson.devDependencies['@angular/forms']).toBeDefined();

      // react specific
      expect(packageJson.devDependencies['@storybook/react']).not.toBeDefined();
      expect(packageJson.devDependencies['@babel/core']).not.toBeDefined();
      expect(packageJson.devDependencies['babel-loader']).not.toBeDefined();
    });

    it('should add react related dependencies when using React as uiFramework', async () => {
      const existing = 'existing';
      const existingVersion = '1.0.0';
      await callRule(
        addDepsToPackageJson(
          { '@nrwl/storybook': storybookVersion, [existing]: existingVersion },
          { [existing]: existingVersion },
          false
        ),
        appTree
      );
      const tree = await runSchematic(
        'init',
        {
          uiFramework: '@storybook/react',
        },
        appTree
      );
      const packageJson = readJsonInTree(tree, 'package.json');

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
    });
  });

  it('should add build-storybook to cacheable operations', async () => {
    const tree = await runSchematic('init', {}, appTree);
    const nxJson = readJsonInTree(tree, 'nx.json');
    expect(
      nxJson.tasksRunnerOptions.default.options.cacheableOperations
    ).toContain('build-storybook');
  });
});
