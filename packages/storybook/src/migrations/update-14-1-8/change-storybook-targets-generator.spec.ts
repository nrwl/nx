import { addProjectConfiguration, readNxJson, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import changeStorybookTargetsGenerator from './change-storybook-targets-generator';
import * as defaultConfig from './test-configs/default-config.json';
import * as customNames from './test-configs/custom-names-config.json';
import * as nonAngular from './test-configs/non-angular.json';
import * as extraOptions from './test-configs/extra-options-for-storybook.json';
import * as noStorybookBuildTarget from './test-configs/no-build-storybook-target.json';
import * as noStorybook from './test-configs/no-storybook-targets.json';

describe('Change the Storybook targets for Angular projects to use native Storybooke executor', () => {
  let tree: Tree;

  describe('for all types of angular projects - non-buildable and buildable libs/apps', () => {
    beforeEach(async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    });

    it(`should set the browserTarget correctly in the Storybook config according to the type of project`, async () => {
      writeConfig(tree, defaultConfig);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });

    it(`should set the browserTarget correctly even if target names are not the default`, async () => {
      writeConfig(tree, customNames);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });

    it(`should keep any extra options added in the target`, async () => {
      writeConfig(tree, extraOptions);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });
    it(`should work even if build-storybook does not exist`, async () => {
      writeConfig(tree, noStorybookBuildTarget);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });

    it(`should not throw an error if no Storybook exists`, async () => {
      writeConfig(tree, noStorybook);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });
  });

  describe('for non-angular projects', () => {
    it(`should not change their Storybook targets`, async () => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      writeConfig(tree, nonAngular);
      await changeStorybookTargetsGenerator(tree);
      expect(readNxJson(tree)).toMatchSnapshot();
    });
  });
});

function writeConfig(tree: Tree, config: any) {
  Object.keys(config.projects).forEach((project) => {
    addProjectConfiguration(tree, project, config.projects[project]);
  });
}
