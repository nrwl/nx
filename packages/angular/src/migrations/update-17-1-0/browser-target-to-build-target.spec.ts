import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  updateJson,
  type NxJsonConfiguration,
  type Tree,
} from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration, { executors } from './browser-target-to-build-target';

describe('browser-target-to-build-target migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
  });

  it.each(executors)(
    'should rename "browserTarget" option from target using the "%s" executor',
    async (executor) => {
      addProjectConfiguration(tree, 'app1', {
        root: 'apps/app1',
        targets: {
          serve: {
            executor,
            options: { browserTarget: 'app1:serve' },
            configurations: {
              development: { browserTarget: 'app1:serve:development' },
              production: { browserTarget: 'app1:serve:production' },
            },
          },
        },
      });

      await migration(tree);

      const project = readProjectConfiguration(tree, 'app1');
      expect(project.targets.serve.options.browserTarget).toBeUndefined();
      expect(project.targets.serve.options.buildTarget).toBe('app1:serve');
      expect(
        project.targets.serve.configurations.development.browserTarget
      ).toBeUndefined();
      expect(project.targets.serve.configurations.development.buildTarget).toBe(
        'app1:serve:development'
      );
      expect(
        project.targets.serve.configurations.production.browserTarget
      ).toBeUndefined();
      expect(project.targets.serve.configurations.production.buildTarget).toBe(
        'app1:serve:production'
      );
    }
  );

  it('should not rename "browserTarget" from target not using the relevant executors', async () => {
    addProjectConfiguration(tree, 'app1', {
      root: 'apps/app1',
      targets: {
        serve: {
          executor: '@org/awesome-plugin:executor',
          options: { browserTarget: 'app1:serve' },
          configurations: {
            development: { browserTarget: 'app1:serve:development' },
            production: { browserTarget: 'app1:serve:production' },
          },
        },
      },
    });

    await migration(tree);

    const project = readProjectConfiguration(tree, 'app1');
    expect(project.targets.serve.options.browserTarget).toBe('app1:serve');
    expect(project.targets.serve.configurations.development.browserTarget).toBe(
      'app1:serve:development'
    );
    expect(project.targets.serve.configurations.production.browserTarget).toBe(
      'app1:serve:production'
    );
  });

  it.each(executors)(
    'should rename "browserTarget" option in nx.json target defaults for a target with the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults.serve = {
          executor,
          options: { browserTarget: '{projectName}:serve' },
          configurations: {
            development: { browserTarget: '{projectName}:serve:development' },
            production: { browserTarget: '{projectName}:serve:production' },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.targetDefaults.serve.options.browserTarget).toBeUndefined();
      expect(nxJson.targetDefaults.serve.options.buildTarget).toBe(
        '{projectName}:serve'
      );
      expect(
        nxJson.targetDefaults.serve.configurations.development.browserTarget
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.serve.configurations.development.buildTarget
      ).toBe('{projectName}:serve:development');
      expect(
        nxJson.targetDefaults.serve.configurations.production.browserTarget
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults.serve.configurations.production.buildTarget
      ).toBe('{projectName}:serve:production');
    }
  );

  it.each(executors)(
    'should rename "browserTarget" option in nx.json target defaults for the "%s" executor',
    async (executor) => {
      updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
        json.targetDefaults ??= {};
        json.targetDefaults[executor] = {
          options: { browserTarget: '{projectName}:serve' },
          configurations: {
            development: { browserTarget: '{projectName}:serve:development' },
            production: { browserTarget: '{projectName}:serve:production' },
          },
        };
        return json;
      });

      await migration(tree);

      const nxJson = readJson<NxJsonConfiguration>(tree, 'nx.json');
      expect(
        nxJson.targetDefaults[executor].options.browserTarget
      ).toBeUndefined();
      expect(nxJson.targetDefaults[executor].options.buildTarget).toBe(
        '{projectName}:serve'
      );
      expect(
        nxJson.targetDefaults[executor].configurations.development.browserTarget
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.development.buildTarget
      ).toBe('{projectName}:serve:development');
      expect(
        nxJson.targetDefaults[executor].configurations.production.browserTarget
      ).toBeUndefined();
      expect(
        nxJson.targetDefaults[executor].configurations.production.buildTarget
      ).toBe('{projectName}:serve:production');
    }
  );
});
