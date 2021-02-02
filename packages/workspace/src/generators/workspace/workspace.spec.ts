import { readJson, Tree } from '@nrwl/devkit';
import { workspaceGenerator } from './workspace';
import { createTree } from '@nrwl/devkit/testing';
import { NxJson } from '../../core/shared-interfaces';

describe('@nrwl/workspace:workspace', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should create files', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    expect(tree.exists('/proj/nx.json')).toBe(true);
    expect(tree.exists('/proj/workspace.json')).toBe(true);
    expect(tree.exists('/proj/.prettierrc')).toBe(true);
    expect(tree.exists('/proj/.prettierignore')).toBe(true);
  });

  it('should create nx.json', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'apps-and-libs',
      defaultBase: 'master',
    });
    const nxJson = readJson<NxJson>(tree, '/proj/nx.json');
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
        '.eslintrc.json': '*',
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

  it('should create a prettierrc file', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    expect(tree.read('proj/.prettierrc').toString()).toMatchSnapshot();
  });

  it('should recommend vscode extensions', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    const recommendations = readJson<{ recommendations: string[] }>(
      tree,
      'proj/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toEqual([
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode',
    ]);
  });

  it('should recommend vscode extensions (angular)', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'angular',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    const recommendations = readJson<{ recommendations: string[] }>(
      tree,
      'proj/.vscode/extensions.json'
    ).recommendations;

    expect(recommendations).toEqual([
      'nrwl.angular-console',
      'angular.ng-template',
      'ms-vscode.vscode-typescript-tslint-plugin',
      'esbenp.prettier-vscode',
    ]);
  });

  it('should add decorate-angular-cli when used with angular cli', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'angular',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    expect(tree.exists('/proj/decorate-angular-cli.js')).toBe(true);
    const packageJson = readJson(tree, '/proj/package.json');
    expect(packageJson.scripts.postinstall).toEqual(
      'node ./decorate-angular-cli.js'
    );
  });

  it('should not add decorate-angular-cli when used with nx cli', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'apps-and-libs',
      defaultBase: 'main',
    });
    expect(tree.exists('/proj/decorate-angular-cli.js')).toBe(false);
    const packageJson = readJson(tree, '/proj/package.json');
    expect(packageJson.scripts.postinstall).toBeUndefined();
  });

  it('should create a workspace using package layout', async () => {
    await workspaceGenerator(tree, {
      name: 'proj',
      directory: 'proj',
      cli: 'nx',
      layout: 'packages',
      defaultBase: 'main',
    });
    expect(tree.exists('/proj/packages/.gitkeep')).toBe(true);
    expect(tree.exists('/proj/apps/.gitkeep')).toBe(false);
    expect(tree.exists('/proj/libs/.gitkeep')).toBe(false);
    const nx = readJson(tree, '/proj/nx.json');
    expect(nx.workspaceLayout).toEqual({
      appsDir: 'packages',
      libsDir: 'packages',
    });
  });
});
