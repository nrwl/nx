import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { detectLinters } from './linter';

describe('detectLinters', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function addPlugin(plugin: string) {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [...(nxJson.plugins ?? []), plugin];
    updateNxJson(tree, nxJson);
  }

  function addDevDependency(pkg: string, version = '1.0.0') {
    const packageJson = JSON.parse(tree.read('package.json', 'utf-8'));
    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      [pkg]: version,
    };
    tree.write('package.json', JSON.stringify(packageJson));
  }

  // A workspace with no linter installed opted out of linting; inferring ESLint
  // for it would override that choice rather than follow it.
  it('should return none when no linter is installed', () => {
    expect(detectLinters(tree)).toEqual([]);
  });

  it.each(['@nx/eslint', 'eslint'])(
    'should detect eslint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinters(tree)).toEqual(['eslint']);
    }
  );

  it.each(['@nx/oxlint', 'oxlint'])(
    'should detect oxlint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinters(tree)).toEqual(['oxlint']);
    }
  );

  it('should detect oxlint from the inference plugin', () => {
    addPlugin('@nx/oxlint');
    expect(detectLinters(tree)).toEqual(['oxlint']);
  });

  it.each(['@nx/eslint', 'eslint'])(
    'should detect eslint from the %s dependency alone',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinters(tree)).toEqual(['eslint']);
    }
  );

  it('should detect eslint from the inference plugin', () => {
    addPlugin('@nx/eslint/plugin');
    expect(detectLinters(tree)).toEqual(['eslint']);
  });

  // Both, rather than just the winner. A caller asking "does this workspace use
  // ESLint at all" would otherwise see `oxlint` and wrongly conclude no — and a
  // project generated for Oxlint still lives under the root ESLint config.
  it('should return both in a hybrid workspace, oxlint first', () => {
    addPlugin('@nx/eslint/plugin');
    addDevDependency('eslint');
    addPlugin('@nx/oxlint');
    addDevDependency('oxlint');

    expect(detectLinters(tree)).toEqual(['oxlint', 'eslint']);
  });

  it('should read expanded plugin registrations', () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      { plugin: '@nx/oxlint', options: { targetName: 'lint' } },
    ];
    updateNxJson(tree, nxJson);

    expect(detectLinters(tree)).toEqual(['oxlint']);
  });

  it('should not report a linter that is only resolvable on disk', () => {
    // `eslint` is a peer dependency of several first-party plugins, so
    // `require('eslint')` succeeds in workspaces that do not use it. Reading
    // the tree is what keeps an empty workspace empty.
    expect(() => require('eslint')).not.toThrow();

    expect(detectLinters(tree)).toEqual([]);
  });
});
