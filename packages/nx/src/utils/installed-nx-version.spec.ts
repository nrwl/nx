import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { setWorkspaceRoot } from './workspace-root';
import { getInstalledNxVersion } from './installed-nx-version';

describe('getInstalledNxVersion', () => {
  let workspaceFixture: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    workspaceFixture = join(
      tmpdir(),
      `nx-version-mismatch-test-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`
    );
    mkdirSync(join(workspaceFixture, 'node_modules', 'nx'), {
      recursive: true,
    });
    writeFileSync(
      join(workspaceFixture, 'node_modules', 'nx', 'package.json'),
      JSON.stringify({ name: 'nx', version: '99.99.99-test' })
    );
    setWorkspaceRoot(workspaceFixture);
  });

  afterEach(() => {
    setWorkspaceRoot(originalCwd);
    rmSync(workspaceFixture, { recursive: true, force: true });
  });

  it("reads the workspace's nx package.json from disk", () => {
    expect(getInstalledNxVersion()).toBe('99.99.99-test');
  });

  it('is immune to Module._pathCache pollution (regression for #35444)', () => {
    // Simulate a polluted cache entry — the kind that gets written when a
    // second `nx` package is loaded into the same process (e.g. the
    // daemon's auto-pull of nx@latest into a tmp dir) and code inside that
    // second package issues a `require.resolve('nx/package.json', { paths })`
    // that triggers self-reference. The polluted value points at a
    // non-existent path with a different version; if `getInstalledNxVersion`
    // were going through `require.resolve` without the cache shield, it
    // would read this stale pointer and return the wrong version.
    const Module = require('module');
    const pollutedPath = '/nonexistent/tmp/nx/package.json';
    // Brute-force pollution: write the bogus value under every cache key
    // that mentions 'nx/package.json'. The fs-walk path reads from disk
    // unconditionally and should be unaffected.
    for (const key of Object.keys(Module._pathCache)) {
      if (key.startsWith('nx/package.json\0')) {
        Module._pathCache[key] = pollutedPath;
      }
    }
    Module._pathCache[`nx/package.json\0${workspaceFixture}/node_modules`] =
      pollutedPath;

    expect(getInstalledNxVersion()).toBe('99.99.99-test');
  });
});
