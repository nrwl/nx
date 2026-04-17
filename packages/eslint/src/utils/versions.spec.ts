import { updateJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { versions } from './versions';

describe('versions(tree)', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ESLINT_USE_FLAT_CONFIG;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ESLINT_USE_FLAT_CONFIG;
    } else {
      process.env.ESLINT_USE_FLAT_CONFIG = originalEnv;
    }
  });

  it('should return the latest ESLint stack for fresh installs', () => {
    const tree = createTreeWithEmptyWorkspace();
    delete process.env.ESLINT_USE_FLAT_CONFIG;

    expect(versions(tree).eslintVersion).toMatch(/^\^10\./);
  });

  it('should pin ESLint v9 for fresh installs when eslintrc is explicitly requested', () => {
    const tree = createTreeWithEmptyWorkspace();
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    expect(versions(tree).eslintVersion).toMatch(/^\^9\./);
  });

  it('should throw when ESLint v10+ is installed and eslintrc is explicitly requested', () => {
    const tree = createTreeWithEmptyWorkspace();
    updateJson(tree, 'package.json', (json) => {
      json.devDependencies = { ...json.devDependencies, eslint: '10.0.0' };
      return json;
    });
    process.env.ESLINT_USE_FLAT_CONFIG = 'false';

    expect(() => versions(tree)).toThrow(
      /does not support the legacy "eslintrc" configuration format/
    );
  });
});
