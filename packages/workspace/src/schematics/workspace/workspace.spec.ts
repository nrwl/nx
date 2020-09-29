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
    expect(tree.exists('/workspace.json')).toBe(true);
    expect(tree.exists('/.prettierrc')).toBe(true);
    expect(tree.exists('/.prettierignore')).toBe(true);
  });

  it('should create nx.json', async () => {
    const tree = await runSchematic('workspace', { name: 'proj' }, projectTree);
    const nxJson = readJsonInTree<NxJson>(tree, '/nx.json');
    expect(nxJson).toEqual({
      npmScope: 'proj',
      affected: {
        defaultBase: 'master',
      },
      implicitDependencies: {
        'workspace.json': '*',
        'package.json': {
          dependencies: '*',
          devDependencies: '*',
        },
        'tsconfig.base.json': '*',
        'tslint.json': '*',
        'nx.json': '*',
      },
      tasksRunnerOptions: {
        default: {
          runner: '@nrwl/workspace/tasks-runners/default',
          options: {
            cacheableOperations: ['build', 'lint', 'test', 'e2e'],
          },
        },
      },
      projects: {},
    });
  });

  it('should recommend vscode extensions', async () => {
    const tree = await runSchematic('workspace', { name: 'proj' }, projectTree);
    const recommendations = readJsonInTree<{ recommendations: string[] }>(
      tree,
      '/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toEqual([
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode',
    ]);
  });

  it('should recommend vscode extensions (angular)', async () => {
    const tree = await runSchematic(
      'workspace',
      { name: 'proj', cli: 'angular' },
      projectTree
    );
    const recommendations = readJsonInTree<{ recommendations: string[] }>(
      tree,
      '/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toEqual([
      'nrwl.angular-console',
      'angular.ng-template',
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode',
    ]);
  });

  it('should add decorate-angular-cli when used with angular cli', async () => {
    const tree = await runSchematic(
      'workspace',
      { name: 'proj', cli: 'angular' },
      projectTree
    );
    expect(tree.exists('/decorate-angular-cli.js')).toBe(true);
    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.scripts.postinstall).toEqual(
      'node ./decorate-angular-cli.js'
    );
  });

  it('should not add decorate-angular-cli when used with nx cli', async () => {
    const tree = await runSchematic(
      'workspace',
      { name: 'proj', cli: 'nx' },
      projectTree
    );
    expect(tree.exists('/decorate-angular-cli.js')).toBe(false);
    const packageJson = readJsonInTree(tree, '/package.json');
    expect(packageJson.scripts.postinstall).toBeUndefined();
  });

  it('should create a workspace using package layout', async () => {
    const tree = await runSchematic(
      'workspace',
      { name: 'proj', cli: 'nx', layout: 'packages' },
      projectTree
    );
    expect(tree.exists('/packages/.gitkeep')).toBe(true);
    expect(tree.exists('/apps/.gitkeep')).toBe(false);
    expect(tree.exists('/libs/.gitkeep')).toBe(false);
    const nx = readJsonInTree(tree, '/nx.json');
    expect(nx.workspaceLayout).toEqual({
      appsDir: 'packages',
      libsDir: 'packages',
    });
  });
});
