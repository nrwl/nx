import '../../internal-testing-utils/mock-prettier';

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
          inputs: [{ projects: 'self', input: 'someInput' }],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
            },
          ],
          inputs: [{ projects: 'dependencies', input: 'someInput' }],
        },
        other: {
          dependsOn: ['^deps'],
        },
      };
      return json;
    });
    await update(tree);
    const nxJson = readNxJson(tree);
    // Migration ran before targetDefaults supported the array shape.
    const td = nxJson.targetDefaults as Record<string, any>;
    const buildDependencyConfiguration = td.build.dependsOn[0] as any;
    const testDependencyConfiguration = td.test.dependsOn[0] as any;
    const buildInputConfiguration = td.build.inputs[0] as any;
    const testInputConfiguration = td.test.inputs[0] as any;
    expect(buildDependencyConfiguration.projects).not.toBeDefined();
    expect(buildDependencyConfiguration.dependencies).not.toBeDefined();
    expect(buildInputConfiguration.projects).not.toBeDefined();
    expect(buildInputConfiguration.dependencies).not.toBeDefined();
    expect(testInputConfiguration.projects).not.toBeDefined();
    expect(testInputConfiguration.dependencies).toEqual(true);
    expect(testDependencyConfiguration.projects).not.toBeDefined();
    expect(testDependencyConfiguration.dependencies).toEqual(true);
    expect(td.other.dependsOn).toEqual(['^deps']);
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
          inputs: [{ projects: 'self', input: 'someInput' }],
        },
        test: {
          dependsOn: [
            {
              projects: 'dependencies',
              target: 'test',
            },
          ],
          inputs: [{ projects: 'dependencies', input: 'someInput' }],
        },
        other: {
          dependsOn: ['^deps'],
        },
      },
    });
    await update(tree);
    const project = readProjectConfiguration(tree, 'proj1');
    const buildDependencyConfiguration = project.targets.build
      .dependsOn[0] as any;
    const testDependencyConfiguration = project.targets.test
      .dependsOn[0] as any;
    const buildInputConfiguration = project.targets.build.inputs[0] as any;
    const testInputConfiguration = project.targets.test.inputs[0] as any;
    expect(buildDependencyConfiguration.projects).not.toBeDefined();
    expect(buildDependencyConfiguration.dependencies).not.toBeDefined();
    expect(buildInputConfiguration.projects).not.toBeDefined();
    expect(buildInputConfiguration.dependencies).not.toBeDefined();
    expect(testDependencyConfiguration.projects).not.toBeDefined();
    expect(testDependencyConfiguration.dependencies).toEqual(true);
    expect(testInputConfiguration.projects).not.toBeDefined();
    expect(testInputConfiguration.dependencies).toEqual(true);
    expect(project.targets.other.dependsOn).toEqual(['^deps']);
    expect(project.targets.other.inputs).not.toBeDefined();
  });

  it('should update nx.json with array-shape targetDefaults', async () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'nx.json', (json) => {
      json.targetDefaults = [
        {
          target: 'build',
          dependsOn: [{ projects: 'self' }],
          inputs: [{ projects: 'self', input: 'someInput' }],
        },
        {
          target: 'test',
          dependsOn: [{ projects: 'dependencies' }],
          inputs: [{ projects: 'dependencies', input: 'someInput' }],
        },
        {
          target: 'other',
          dependsOn: ['^deps'],
        },
      ];
      return json;
    });
    await update(tree);
    const td = readNxJson(tree).targetDefaults as any[];
    const buildEntry = td.find((e) => e.target === 'build');
    const testEntry = td.find((e) => e.target === 'test');
    const otherEntry = td.find((e) => e.target === 'other');
    expect(buildEntry.dependsOn[0].projects).not.toBeDefined();
    expect(buildEntry.dependsOn[0].dependencies).not.toBeDefined();
    expect(buildEntry.inputs[0].projects).not.toBeDefined();
    expect(buildEntry.inputs[0].dependencies).not.toBeDefined();
    expect(testEntry.dependsOn[0].projects).not.toBeDefined();
    expect(testEntry.dependsOn[0].dependencies).toEqual(true);
    expect(testEntry.inputs[0].projects).not.toBeDefined();
    expect(testEntry.inputs[0].dependencies).toEqual(true);
    expect(otherEntry.dependsOn).toEqual(['^deps']);
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
