import { readNxJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { detectLinter } from './linter';

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

  it('should fall back to eslint when nothing is detected', () => {
    expect(detectLinter(tree)).toBe('eslint');
  });

  it.each(['@nx/oxlint', 'oxlint'])(
    'should detect oxlint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinter(tree)).toBe('oxlint');
    }
  );

  it.each(['@nx/oxlint', '@nx/oxlint/plugin'])(
    'should detect oxlint from the %s inference plugin',
    (plugin) => {
      addPlugin(plugin);
      expect(detectLinter(tree)).toBe('oxlint');
    }
  );

  it.each(['@nx/eslint', 'eslint'])(
    'should detect eslint from the %s dependency',
    (pkg) => {
      addDevDependency(pkg);
      expect(detectLinter(tree)).toBe('eslint');
    }
  );

  it('should detect eslint from the inference plugin', () => {
    addPlugin('@nx/eslint/plugin');
    expect(detectLinter(tree)).toBe('eslint');
  });

  it('should prefer oxlint in a hybrid workspace', () => {
    addPlugin('@nx/eslint/plugin');
    addDevDependency('eslint');
    addPlugin('@nx/oxlint/plugin');
    addDevDependency('oxlint');

    expect(detectLinter(tree)).toBe('oxlint');
  });

  it('should read expanded plugin registrations', () => {
    const nxJson = readNxJson(tree);
    nxJson.plugins = [
      { plugin: '@nx/oxlint/plugin', options: { targetName: 'lint' } },
    ];
    updateNxJson(tree, nxJson);

    expect(detectLinter(tree)).toBe('oxlint');
  });
});
