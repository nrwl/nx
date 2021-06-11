import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree, updateJsonInTree } from '@nrwl/workspace';
import type { NxJsonConfiguration } from '@nrwl/devkit';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { callRule, runMigration } from '../../utils/testing';

describe('Update 9.2.0', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  describe('for projects with no tasks runner options', () => {
    it('should add configuration for cacheable operations', async () => {
      tree = await runMigration('update-9-2-0', {}, tree);
      const nxJson = readJsonInTree<NxJsonConfiguration>(tree, 'nx.json');
      expect(nxJson.tasksRunnerOptions).toEqual({
        default: {
          runner: '@nrwl/workspace/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'lint', 'test', 'e2e'],
          },
        },
      });
    });
  });

  describe('for projects with tasks runner options', () => {
    describe('with @nrwl/workspace/src/tasks-runner/default-task-runner', () => {
      it('should add configuration for cacheable operations', async () => {
        tree = await callRule(
          updateJsonInTree('nx.json', (json) => {
            json.tasksRunnerOptions = {
              default: {
                runner: '@nrwl/workspace/src/tasks-runner/default-task-runner',
                options: {
                  cacheableOperations: ['custom-operation'],
                },
              },
            };

            return json;
          }),
          tree
        );
        tree = await runMigration('update-9-2-0', {}, tree);
        const nxJson = readJsonInTree<NxJsonConfiguration>(tree, 'nx.json');
        expect(nxJson.tasksRunnerOptions).toEqual({
          default: {
            runner: '@nrwl/workspace/tasks-runners/default',
            options: {
              cacheableOperations: [
                'custom-operation',
                'build',
                'lint',
                'test',
                'e2e',
              ],
            },
          },
        });
      });
    });

    describe('with @nrwl/workspace/src/tasks-runner/tasks-runner-v2', () => {
      it('should add configuration for cacheable operations', async () => {
        tree = await callRule(
          updateJsonInTree('nx.json', (json) => {
            json.tasksRunnerOptions = {
              default: {
                runner: '@nrwl/workspace/src/tasks-runner/tasks-runner-v2',
                options: {
                  cacheableOperations: ['custom-operation'],
                },
              },
            };

            return json;
          }),
          tree
        );
        tree = await runMigration('update-9-2-0', {}, tree);
        const nxJson = readJsonInTree<NxJsonConfiguration>(tree, 'nx.json');
        expect(nxJson.tasksRunnerOptions).toEqual({
          default: {
            runner: '@nrwl/workspace/tasks-runners/default',
            options: {
              cacheableOperations: [
                'custom-operation',
                'build',
                'lint',
                'test',
                'e2e',
              ],
            },
          },
        });
      });
    });
  });
});
