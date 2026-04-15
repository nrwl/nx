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

  it('should return the latest ESLint stack for fresh installs regardless of the flat-config preference', () => {
    const tree = createTreeWithEmptyWorkspace();

    process.env.ESLINT_USE_FLAT_CONFIG = 'false';
    const eslintrcResult = versions(tree);

    process.env.ESLINT_USE_FLAT_CONFIG = 'true';
    const flatResult = versions(tree);

    expect(eslintrcResult).toEqual(flatResult);
    expect(eslintrcResult.eslintVersion).toMatch(/^\^10\./);
  });
});
