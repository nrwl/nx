import { NxJsonConfiguration, readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import removeOldTaskRunnerOptions from '@nrwl/workspace/src/migrations/update-13-6-0/remove-old-task-runner-options';

describe('removeOldTaskRunnerOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should remove scan and analytics', () => {
    writeJson<NxJsonConfiguration>(tree, 'nx.json', {
      npmScope: 'scope',
      tasksRunnerOptions: {
        default: {
          runner: 'runner',
          options: {
            scan: true,
            analytics: 'hi',
          },
        },
      },
    });
    removeOldTaskRunnerOptions(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({
      npmScope: 'scope',
      tasksRunnerOptions: {
        default: {
          runner: 'runner',
          options: {},
        },
      },
    });
  });

  it("should not fail if nx.json doesn't have taskRunnerOptions", () => {
    writeJson(tree, 'nx.json', {});
    removeOldTaskRunnerOptions(tree);
    const result = readJson(tree, 'nx.json');
    expect(result).toEqual({});
  });
});
