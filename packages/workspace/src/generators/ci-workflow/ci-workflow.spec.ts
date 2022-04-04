import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { ciWorkflowGenerator } from './ci-workflow';

describe('lib', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should generate github CI config', async () => {
    await ciWorkflowGenerator(tree, { ci: 'github' });

    expect(tree.read('.github/workflows/build.yml', 'utf-8')).toMatchSnapshot();
  });

  it('should generate circleci CI config', async () => {
    await ciWorkflowGenerator(tree, { ci: 'circleci' });

    expect(tree.read('.circleci/config.yml', 'utf-8')).toMatchSnapshot();
  });

  it('should generate azure CI config', async () => {
    await ciWorkflowGenerator(tree, { ci: 'azure' });

    expect(tree.read('azure-pipelines.yml', 'utf-8')).toMatchSnapshot();
  });
});
