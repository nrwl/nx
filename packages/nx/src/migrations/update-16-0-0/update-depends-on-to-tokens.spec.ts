import {
  addProjectConfiguration,
  readNxJson,
  readProjectConfiguration,
} from '../../generators/utils/project-configuration';

import update from './update-depends-on-to-tokens';
import { updateJson, writeJson } from '../../generators/utils/json';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';

describe('update-depends-on-to-tokens', () => {
  it('should update nx.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json) => {
      json.targetDefaults = {
        build: {
          dependsOn: [
            {
              projects: 'self',
            },
          ],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
            },
          ],
        },
        other: {
          dependsOn: ['^deps'],
        },
      };
      return json;
    });
    await update(tree);
    const nxJson = readNxJson(tree);
    const build = nxJson.targetDefaults.build.dependsOn[0] as any;
    const test = nxJson.targetDefaults.test.dependsOn[0] as any;
    expect(build.projects).toEqual('{self}');
    expect(test.projects).toEqual('{dependencies}');
    expect(nxJson.targetDefaults.other.dependsOn).toEqual(['^deps']);
  });

  it('should update project configurations', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
      targets: {
        build: {
          dependsOn: [
            {
              projects: 'self',
              target: 'build',
            },
          ],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
              target: 'test',
            },
          ],
        },
        other: {
          dependsOn: ['^deps'],
        },
      },
    });
    await update(tree);
    const project = readProjectConfiguration(tree, 'proj1');
    const build = project.targets.build.dependsOn[0] as any;
    const test = project.targets.test.dependsOn[0] as any;
    expect(build.projects).toEqual('{self}');
    expect(test.projects).toEqual('{dependencies}');
    expect(project.targets.other.dependsOn).toEqual(['^deps']);
  });

  it('should not throw on nulls', async () => {
    const tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'proj1', {
      root: 'proj1',
    });
    addProjectConfiguration(tree, 'proj2', {
      root: 'proj2',
      targets: {
        build: {},
      },
    });
    writeJson(tree, 'nx.json', {});
    let promise = update(tree);
    await expect(promise).resolves.toBeUndefined();
    writeJson(tree, 'nx.json', {
      targetDefaults: {
        build: {},
      },
    });
    promise = update(tree);
    await expect(promise).resolves.toBeUndefined();
  });
});
