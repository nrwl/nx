import { addProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

export function createTreeWithNestApplication(appName: string): Tree {
  const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  addProjectConfiguration(tree, appName, {
    root: `apps/${appName}`,
    sourceRoot: `apps/${appName}/src`,
    projectType: 'application',
    targets: {},
  });
  return tree;
}
