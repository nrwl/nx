import { addProjectConfiguration, Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

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
