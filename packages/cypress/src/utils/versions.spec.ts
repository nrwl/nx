import { updateJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { cypressVersion, versions } from './versions';

function declareCypress(tree: Tree, version: string): void {
  updateJson(tree, 'package.json', (json) => {
    json.devDependencies = { ...json.devDependencies, cypress: version };
    return json;
  });
}

function installCypress(tree: Tree, version: string): void {
  tree.write(
    'node_modules/cypress/package.json',
    JSON.stringify({ name: 'cypress', version })
  );
}

describe('versions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should return the latest versions when cypress is not declared', () => {
    expect(versions(tree).cypressVersion).toBe(cypressVersion);
    expect(cypressVersion).toMatch(/^\^16\./);
  });

  it('should return the compatible versions for the declared cypress major', () => {
    declareCypress(tree, '^15.20.1');

    expect(versions(tree)).toMatchObject({
      cypressVersion: '^15.20.1',
      cypressViteDevServerVersion: '^7.3.1',
      cypressWebpackVersion: '^5.4.1',
      viteVersion: '^6.0.0',
    });
  });

  it('should use the installed cypress version when it satisfies a range spanning majors', () => {
    declareCypress(tree, '>=15.20.1 <17');
    installCypress(tree, '16.0.0');

    expect(versions(tree).cypressVersion).toBe(cypressVersion);
  });

  it('should fall back to the floor of a range spanning majors when cypress is not installed', () => {
    declareCypress(tree, '>=15.20.1 <17');

    expect(versions(tree).cypressVersion).toBe('^15.20.1');
  });
});
