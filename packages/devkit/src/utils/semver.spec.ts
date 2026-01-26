import type { Tree } from 'nx/src/generators/tree';
import { TempFs } from '../../internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '../../testing';
import { checkAndCleanWithSemver } from './semver';

describe('checkAndCleanWithSemver', () => {
  let tree: Tree;
  let tempFs: TempFs;

  beforeEach(() => {
    tempFs = new TempFs('semver-test');
    tree = createTreeWithEmptyWorkspace();
    tree.root = tempFs.tempDir;
    tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
  });

  afterEach(() => {
    tempFs.cleanup();
  });

  it('should validate and clean semver versions', () => {
    // Test with caret prefix
    expect(checkAndCleanWithSemver('package', '^1.2.3')).toBe('1.2.3');
    // Test with tilde prefix
    expect(checkAndCleanWithSemver('package', '~1.2.3')).toBe('1.2.3');
    // Test with valid semver
    expect(checkAndCleanWithSemver('package', '1.2.3')).toBe('1.2.3');
    // Test invalid version throws error
    expect(() => checkAndCleanWithSemver('package', 'invalid')).toThrow(
      'The package.json lists a version of package that Nx is unable to validate'
    );
  });

  it('should resolve catalog references before validating semver', () => {
    const yamlContent = `
packages:
  - packages/*

catalog:
  react: ^18.2.0
  lodash: ~4.17.21

catalogs:
  testing:
    jest: ^29.0.0
`;
    tree.write('pnpm-workspace.yaml', yamlContent);

    // Test default catalog reference
    expect(checkAndCleanWithSemver(tree, 'react', 'catalog:')).toBe('18.2.0');
    // Test default catalog with tilde prefix
    expect(checkAndCleanWithSemver(tree, 'lodash', 'catalog:')).toBe('4.17.21');
    // Test named catalog reference
    expect(checkAndCleanWithSemver(tree, 'jest', 'catalog:testing')).toBe(
      '29.0.0'
    );
    // Test invalid catalog reference throws error
    expect(() =>
      checkAndCleanWithSemver(tree, 'nonexistent', 'catalog:')
    ).toThrow('The catalog reference for nonexistent is invalid');
    // Test invalid named catalog throws error
    expect(() =>
      checkAndCleanWithSemver(tree, 'package', 'catalog:nonexistent')
    ).toThrow('The catalog reference for package is invalid');
  });
});
