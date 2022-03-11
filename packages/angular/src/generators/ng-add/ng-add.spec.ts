import * as angularCliMigrator from './migrate-from-angular-cli';
import * as initGenerator from '../init/init';
import { ngAddGenerator } from './ng-add';
import { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

describe('ngAdd generator', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
    jest
      .spyOn(angularCliMigrator, 'migrateFromAngularCli')
      .mockImplementation(() => Promise.resolve(() => {}));
    jest
      .spyOn(initGenerator, 'angularInitGenerator')
      .mockImplementation(() => Promise.resolve(() => {}));
    jest.clearAllMocks();
  });

  it('should initialize the Angular plugin when in an Nx workspace', async () => {
    await ngAddGenerator(tree, {});

    expect(initGenerator.angularInitGenerator).toHaveBeenCalled();
    expect(angularCliMigrator.migrateFromAngularCli).not.toHaveBeenCalled();
  });

  it('should perform a migration when in an Angular CLI workspace', async () => {
    tree.delete('nx.json');

    await ngAddGenerator(tree, {});

    expect(angularCliMigrator.migrateFromAngularCli).toHaveBeenCalled();
    expect(initGenerator.angularInitGenerator).not.toHaveBeenCalled();
  });
});
