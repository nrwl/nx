import { NxJsonConfiguration, Tree, updateJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { ciWorkflowGenerator } from './ci-workflow';

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate github CI config', async () => {
    setNxCloud(tree);
    await ciWorkflowGenerator(tree, { ci: 'github' });

    expect(tree.read('.github/workflows/build.yml', 'utf-8')).toMatchSnapshot();
  });

  it('should generate circleci CI config', async () => {
    setNxCloud(tree);
    await ciWorkflowGenerator(tree, { ci: 'circleci' });

    expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
  });

  it('should generate azure CI config', async () => {
    setNxCloud(tree);
    await ciWorkflowGenerator(tree, { ci: 'azure' });

    expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchSnapshot();
  });

  it('should generate github CI config with custom name', async () => {
    setNxCloud(tree);
    await ciWorkflowGenerator(tree, {
      ci: 'github',
      name: 'My custom-workflow',
    });

    expect(
      tree.read('.github/workflows/my-custom-workflow.yml', 'utf-8')
    ).toMatchSnapshot();
  });

  it('should throw error is nx cloud is not set', async () => {
    await expect(
      ciWorkflowGenerator(tree, {
        ci: 'github',
      })
    ).rejects.toThrowErrorMatchingSnapshot();
  });
});

function setNxCloud(tree: Tree) {
  updateJson<NxJsonConfiguration>(tree, 'nx.json', (json) => {
    return {
      ...json,
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/nx-cloud',
        },
      },
    };
  });
}
