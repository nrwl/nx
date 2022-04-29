import { Tree, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { readWorkspace } from 'packages/devkit/src/generators/project-configuration';
import setProjectBuildConfig from './set-project-build-config';
import * as defaultConfig from './test-configs/default-config.json';
import * as customNames from './test-configs/custom-names-config.json';
import * as nonAngular from './test-configs/non-angular.json';

describe('Set the projectBuildConfig option in the Storybook configuration for Angular projects', () => {
  let tree: Tree;

  describe('for all types of angular projects - non-buildable and buildable libs/apps', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
    });

    it(`should set the projectBuildConfig in the Storybook config according to the type of project`, async () => {
      writeJson(tree, 'workspace.json', defaultConfig);
      await setProjectBuildConfig(tree);
      expect(readWorkspace(tree)).toMatchSnapshot();
    });

    it(`should still set the projectBuildConfig even if target names are not the default`, async () => {
      writeJson(tree, 'workspace.json', customNames);
      await setProjectBuildConfig(tree);
      expect(readWorkspace(tree)).toMatchSnapshot();
    });
  });

  describe('for non-angular projects', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'workspace.json', nonAngular);
    });

    it(`should not change their Storybook configuration`, async () => {
      await setProjectBuildConfig(tree);
      expect(readWorkspace(tree)).toMatchSnapshot();
    });
  });
});
