import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { useFlatConfig } from './flat-config';

describe('useFlatConfig', () => {
  let tree: Tree;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    originalEnv = process.env.ESLINT_USE_FLAT_CONFIG;
    delete process.env.ESLINT_USE_FLAT_CONFIG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEnv;
    }
  });

  it('should honor the ESLINT_USE_FLAT_CONFIG env var over the tree', () => {
    tree.write('.eslintrc.json', '{}');

    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    expect(useFlatConfig(tree)).toBe(true);

    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    expect(useFlatConfig(tree)).toBe(false);
  });

  it('should use flat config when a root flat config file exists', () => {
    tree.write('eslint.config.mjs', 'export default [];');
    expect(useFlatConfig(tree)).toBe(true);
  });

  it('should not use flat config when a root eslintrc file exists', () => {
    tree.write('.eslintrc.json', '{}');
    expect(useFlatConfig(tree)).toBe(false);
  });

  it('should default to flat config when no config file exists', () => {
    expect(useFlatConfig(tree)).toBe(true);
  });
});
