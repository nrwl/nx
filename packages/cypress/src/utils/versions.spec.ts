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

  it('should keep the installed cypress version when it is the floor of a range spanning majors', () => {
    declareCypress(tree, '>=15.20.1 <17');
    installCypress(tree, '15.20.1');

    expect(versions(tree).cypressVersion).toBe('^15.20.1');
  });

  it.each([
    ['>=15.20.1 <17', cypressVersion],
    ['>=14 <16', '^15.20.1'],
    ['>=14 <15.10', '^15.20.1'],
    ['>=13 <14.5', '^14.2.1'],
  ])(
    'should resolve the range %s to the highest supported major it reaches when cypress is not installed',
    (range, expected) => {
      declareCypress(tree, range);

      expect(versions(tree).cypressVersion).toBe(expected);
    }
  );
});
