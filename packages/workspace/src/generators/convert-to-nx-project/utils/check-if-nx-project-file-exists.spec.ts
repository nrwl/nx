import {
  addProjectConfiguration,
  ProjectConfiguration,
  Tree,
} from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { join } from 'path';
import { checkIfNxProjectFileExists } from './check-if-nx-project-file-exists';

describe('check if project.json file exists', () => {
  let tree: Tree;
  let projectConfig: ProjectConfiguration = {
    root: 'apps/test-project',
    targets: {},
  };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    addProjectConfiguration(tree, 'test-project', projectConfig);
  });

  it('should return false if project.json does not exist', () => {
    const result = checkIfNxProjectFileExists(tree, projectConfig);
    expect(result).toBeFalsy();
  });

  it('should return true if project.json does exist', () => {
    tree.write(join(projectConfig.root, 'project.json'), '');
    const result = checkIfNxProjectFileExists(tree, projectConfig);
    expect(result).toBeTruthy();
  });
});
