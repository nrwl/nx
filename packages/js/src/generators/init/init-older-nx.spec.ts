import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

// An older nx - `@nx/devkit`'s peer allows one a major back - exports none of
// the formatter helpers, so the assert throws. Simulated rather than installed.
jest.mock('../../utils/nx-formatter-internals', () => ({
  assertNxSupportsFormatters: jest.fn(() => {
    throw new Error('OLDER_NX');
  }),
}));

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual('@nx/devkit'),
  ensurePackage: jest.fn(),
}));

import init from './init';

describe('js init generator on an older nx', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ formatter: 'none' });
    tree.delete('tsconfig.base.json');
  });

  it('should still run when the caller asked for no formatter', async () => {
    // "none" reaches no formatter code, so requiring the helpers here locked
    // an older nx out of `@nx/js:init` entirely.
    await expect(init(tree, { formatter: 'none' })).resolves.toBeDefined();
  });

  it('should fail when it has to detect the formatter', async () => {
    await expect(init(tree, {})).rejects.toThrow('OLDER_NX');
  });

  it.each(['prettier', 'oxfmt'] as const)(
    'should fail when setting up %s',
    async (formatter) => {
      await expect(init(tree, { formatter })).rejects.toThrow('OLDER_NX');
    }
  );
});
