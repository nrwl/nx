import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

export function createTreeWithNestApplication(appName: string): Tree {
  const tree = createTreeWithEmptyWorkspace();
  addProjectConfiguration(tree, appName, {
    root: `${appName}`,
    sourceRoot: `${appName}/src`,
    projectType: 'application',
    targets: {},
  });
  return tree;
}
