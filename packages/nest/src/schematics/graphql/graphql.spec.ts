import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '@nrwl/workspace';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runSchematic } from '../../utils/testing';

describe('@nrwl/nest:graphql', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = Tree.empty();
    appTree = createEmptyWorkspace(appTree);
    appTree = await runSchematic('app', { name: 'myApi' }, appTree);
  });

  it('should configure @nestjs/graphql in a nest app', async () => {
    const tree = await runSchematic('graphql', { project: 'my-api' }, appTree);

    expect(tree.exists('apps/my-api/src/app/app.resolver.ts')).toBeTruthy();
  });

  describe('@nestjs/graphql dependencies', () => {
    it('should be added by default', async () => {
      const tree = await runSchematic(
        'graphql',
        { project: 'my-api' },
        appTree
      );

      const packageJson = readJsonInTree(tree, 'package.json');
      expect(packageJson.dependencies['@nestjs/graphql']).toBeDefined();
      expect(packageJson.dependencies['apollo-server-express']).toBeDefined();
    });

    it('should not be added with --skipPackageJson', async () => {
      const tree = await runSchematic(
        'graphql',
        { project: 'my-api', skipPackageJson: true },
        appTree
      );

      const packageJson = readJsonInTree(tree, 'package.json');
      expect(packageJson.dependencies['@nestjs/graphql']).toBeFalsy();
      expect(packageJson.dependencies['apollo-server-express']).toBeFalsy();
    });
  });
});
