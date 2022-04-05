import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { addProjectConfiguration, Tree } from '@nrwl/devkit';

import { findFreePort } from './find-free-port';

describe('findFreePort', () => {
  it('should return the largest port + 1', () => {
    const tree = createTreeWithEmptyWorkspace();
    addProject(tree, 'app1', 4200);
    addProject(tree, 'app2', 4201);
    addProject(tree, 'no-serve');

    const port = findFreePort(tree);

    expect(port).toEqual(4202);
  });

  it('should default to port 4200', () => {
    const tree = createTreeWithEmptyWorkspace();
    addProject(tree, 'no-serve');

    const port = findFreePort(tree);

    expect(port).toEqual(4200);
  });
});

function addProject(tree: Tree, name: string, port?: number) {
  addProjectConfiguration(tree, name, {
    name: 'app1',
    root: '/app1',
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
