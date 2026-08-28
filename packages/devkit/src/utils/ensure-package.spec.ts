import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Recomputed inside the factory because `jest.mock` is hoisted above any
// module-scope const it would otherwise close over.
const fixtureRoot = join(tmpdir(), `nx-ensure-package-${process.pid}`);

jest.mock('nx/src/devkit-exports', () => ({
  ...jest.requireActual('nx/src/devkit-exports'),
  workspaceRoot: require('path').join(
    require('os').tmpdir(),
    `nx-ensure-package-${process.pid}`
  ),
}));

jest.mock('nx/src/devkit-internals', () => ({
  ...jest.requireActual('nx/src/devkit-internals'),
  installPackageToTmp: jest.fn(() => {
    throw new Error('installPackageToTmp should not have been reached');
  }),
}));

import { ensurePackage } from './package-json';

describe('ensurePackage resolution', () => {
  beforeAll(() => {
    const packageDir = join(
      fixtureRoot,
      'node_modules',
      'ensure-package-fixture'
    );
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'ensure-package-fixture',
        version: '1.0.0',
        main: 'index.js',
      })
    );
    writeFileSync(
      join(packageDir, 'index.js'),
      `module.exports = { resolvedFrom: 'workspace' };`
    );
  });

  afterAll(() => {
    rmSync(fixtureRoot, { recursive: true, force: true });
  });

  it('should resolve a package installed in the workspace but not next to @nx/devkit', () => {
    expect(ensurePackage('ensure-package-fixture', '1.0.0')).toEqual({
      resolvedFrom: 'workspace',
    });
  });

  it('should still resolve packages that are only next to @nx/devkit', () => {
    expect(ensurePackage('@nx/devkit', '>=15.0.0')).toEqual(
      require('@nx/devkit')
    );
  });
});
