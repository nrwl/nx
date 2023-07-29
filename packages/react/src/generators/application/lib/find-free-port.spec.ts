import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { addProjectConfiguration, Tree } from '@nx/devkit';

import { findFreePort } from './find-free-port';

describe('findFreePort', () => {
  it('should return the largest port + 1', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProject(tree, 'app1', 4200);
    addProject(tree, 'app2', 4201);
    addProject(tree, 'no-serve');

    const port = findFreePort(tree);

    expect(port).toEqual(4202);
  });

  it('should default to port 4200', () => {
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProject(tree, 'no-serve');

    const port = findFreePort(tree);

    expect(port).toEqual(4200);
  });
});

function addProject(tree: Tree, name: string, port?: number) {
  addProjectConfiguration(tree, name, {
    name: name,
    root: `/${name}`,
    targets: port
      ? {
          serve: {
            executor: '',
            options: { port },
          },
        }
      : {},
  });
}
