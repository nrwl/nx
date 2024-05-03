import { ProjectGraphProjectNode } from '../../devkit-exports';
import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { addProjectConfiguration } from '../../generators/utils/project-configuration';
import { showProjectsHandler } from './show';

describe('show', () => {
  let appTree: Tree;

  beforeEach(() => {
    appTree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(appTree, 'proj1', { root: 'proj1' });
    addProjectConfiguration(appTree, 'proj2', { root: 'proj2' });
    addProjectConfiguration(appTree, 'proj3', { root: 'proj3' });
  });

  it('should print out projects with provided seperator value', async () => {
    jest.spyOn(console, 'log');

    await showProjectsHandler({
      exclude: '',
      files: '',
      uncommitted: false,
      untracked: false,
      base: '',
      head: '',
      affected: false,
      type: 'lib',
      projects: [],
      withTarget: [],
      verbose: false,
      sep: ',',
    });

    expect(console.log).toHaveBeenCalledWith('proj1,proj2,proj3');
  });
});
