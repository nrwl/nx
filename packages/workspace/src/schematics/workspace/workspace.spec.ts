import { Tree } from '@angular-devkit/schematics';
import { NxJson, readJsonInTree } from '@nrwl/workspace';
import { runSchematic } from '../../utils/testing';

describe('workspace', () => {
  let projectTree: Tree;

  beforeEach(() => {
    projectTree = Tree.empty();
  });

  it('should create files', async () => {
    const tree = await runSchematic('workspace', { name: 'proj' }, projectTree);
    expect(tree.exists('/nx.json')).toBe(true);
    expect(tree.exists('/angular.json')).toBe(true);
    expect(tree.exists('/.prettierrc')).toBe(true);
    expect(tree.exists('/.prettierignore')).toBe(true);
  });

  it('should create nx.json', async () => {
    const tree = await runSchematic('workspace', { name: 'proj' }, projectTree);
    const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
    expect(nxJson).toEqual({
      npmScope: 'proj',
      implicitDependencies: {
        'angular.json': '*',
        'package.json': '*',
        'tsconfig.json': '*',
        'tslint.json': '*',
        'nx.json': '*'
      },
      projects: {}
    });
  });

  it('should recommend vscode extensions', async () => {
    const tree = await runSchematic('workspace', { name: 'proj' }, projectTree);
    const recommendations = readJsonInTree<{ recommendations: string[] }>(
      tree,
      '/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toEqual([
      'nrwl.angular-console',
      'angular.ng-template',
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode'
    ]);
  });

  it('should configure the project to use style argument', async () => {
    const tree = await runSchematic(
      'workspace',
      { name: 'proj', style: 'scss' },
      projectTree
    );
    expect(JSON.parse(tree.readContent('/angular.json')).schematics).toEqual({
      '@nrwl/workspace:application': {
        style: 'scss'
      },
      '@nrwl/workspace:library': {
        style: 'scss'
      }
    });
  });
});
