import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { root } = vi.hoisted(() => {
  const { mkdtempSync, realpathSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  return {
    root: realpathSync(mkdtempSync(join(tmpdir(), 'nx-version-mismatch-'))),
  };
});

vi.mock('../utils/workspace-root', () => ({ workspaceRoot: root }));
vi.mock('../utils/versions', async () => ({
  ...(await vi.importActual('../utils/versions')),
  nxVersion: '24.0.0',
}));

import * as installedNxVersion from '../utils/installed-nx-version';
import { isNxVersionMismatch } from './is-nx-version-mismatch';

const link = join(root, 'node_modules', 'nx');

function install(version: string) {
  const dir = join(
    root,
    'node_modules',
    '.pnpm',
    `nx@${version}`,
    'node_modules',
    'nx'
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'nx', version })
  );
}

function pointNxAt(version: string) {
  rmSync(link, { force: true });
  symlinkSync(join('.pnpm', `nx@${version}`, 'node_modules', 'nx'), link);
}

describe('isNxVersionMismatch', () => {
  beforeAll(() => {
    install('24.0.0');
    install('24.0.1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('sees node_modules/nx re-pointed to another version within the same process', () => {
    pointNxAt('24.0.0');
    expect(isNxVersionMismatch()).toBe(false);

    pointNxAt('24.0.1');
    expect(isNxVersionMismatch()).toBe(true);
  });

  it('falls back to the resolver when there is no node_modules/nx, as under Yarn PnP', () => {
    rmSync(link, { force: true });
    const getInstalledNxVersion = vi
      .spyOn(installedNxVersion, 'getInstalledNxVersion')
      .mockReturnValue('24.0.1');

    expect(isNxVersionMismatch()).toBe(true);
    expect(getInstalledNxVersion).toHaveBeenCalledTimes(1);
  });
});
