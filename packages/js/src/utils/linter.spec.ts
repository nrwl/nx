import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { detectLinter, detectLinters } from './linter';

describe('detectLinter', () => {
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
    expect(detectLinter(tree)).toBe('none');
  });

  it.each(['@nx/eslint', 'eslint'])(
    'should detect eslint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinter(tree)).toBe('eslint');
    }
  );

  it.each(['@nx/oxlint', 'oxlint'])(
    'should detect oxlint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinter(tree)).toBe('oxlint');
    }
  );

  it('should detect oxlint from the inference plugin', () => {
    addPlugin('@nx/oxlint');
    expect(detectLinter(tree)).toBe('oxlint');
  });

  // ESLint is also the fallback, so these pin that an ESLint workspace is not
  // mistaken for an Oxlint one — they cannot distinguish detection from the
  // fallthrough, and are not meant to.
  it.each(['@nx/eslint', 'eslint'])(
    'should stay on eslint with the %s dependency present',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinter(tree)).toBe('eslint');
    }
  );

  it('should stay on eslint with the inference plugin present', () => {
    addPlugin('@nx/eslint/plugin');
    expect(detectLinter(tree)).toBe('eslint');
  });

  it('should prefer oxlint in a hybrid workspace', () => {
    addPlugin('@nx/eslint/plugin');
    addDevDependency('eslint');
    addPlugin('@nx/oxlint');
    addDevDependency('oxlint');

    expect(detectLinter(tree)).toBe('oxlint');
  });

  it('should read expanded plugin registrations', () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      { plugin: '@nx/oxlint', options: { targetName: 'lint' } },
    ];
    updateNxJson(tree, nxJson);

    expect(detectLinter(tree)).toBe('oxlint');
  });

  describe('detectLinters', () => {
    it('should return nothing when no linter is installed', () => {
      expect(detectLinters(tree)).toEqual([]);
    });

    it('should return the one linter a workspace uses', () => {
      addDevDependency('eslint');

      expect(detectLinters(tree)).toEqual(['eslint']);
    });

    // The reason this exists: `detectLinter` can only name the winner, so a
    // caller asking "does this workspace use ESLint at all" gets `oxlint` and
    // wrongly concludes no. A project generated for Oxlint still lives under
    // the root ESLint config.
    it('should return both in a hybrid workspace, oxlint first', () => {
      addDevDependency('eslint');
      addDevDependency('oxlint');

      expect(detectLinters(tree)).toEqual(['oxlint', 'eslint']);
      expect(detectLinters(tree)).toContain('eslint');
    });

    it('should not report a linter that is only resolvable on disk', () => {
      // `eslint` is a peer dependency of several first-party plugins, so
      // `require('eslint')` succeeds in workspaces that do not use it. This
      // reads the tree, so an empty workspace stays empty.
      expect(() => require('eslint')).not.toThrow();

      expect(detectLinters(tree)).toEqual([]);
    });
  });
});
