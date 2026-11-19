import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logger } from '../../../utils/logger';
import * as packageManager from '../../../utils/package-manager';
import {
  getPrunedPnpmInstallArtifacts,
  getPrunedPnpmInstallSettingsYaml,
  getPrunedPnpmLocalPathArtifacts,
  validatePrunedLocalPathClosure,
} from './pruned-output';

const yaml = (value: string) => require('@zkochan/js-yaml').load(value);

describe('pnpm v13 pruned output artifacts', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-pnpm-v13-artifacts-'));
    vi.spyOn(packageManager, 'getPackageManagerVersion').mockReturnValue(
      '12.22.0'
    );
    mkdirSync(join(root, 'patches'), { recursive: true });
    writeFileSync(join(root, 'patches/foo.patch'), 'patch content');
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      `allowBuilds:\n  foo: true\n  absent: true\npatchedDependencies:\n  foo@1.0.0: patches/foo.patch\n  absent@1.0.0: patches/absent.patch\n`
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  const lockfile = `lockfileVersion: '13.0'
settings:
  patchedDependencies:
    foo@1.0.0: hash
projects:
  .:
    dependencies:
      foo: 1.0.0
packages:
  foo@1.0.0:
    integrity: sha512-AAAA
`;

  it('ships only retained patches and build approvals for a standalone output', () => {
    const artifacts = getPrunedPnpmInstallArtifacts(root, lockfile, {
      name: 'app',
      version: '1.0.0',
    });
    expect(
      yaml(
        artifacts.find((a) => a.path === 'pnpm-workspace.yaml')
          .content as string
      )
    ).toEqual({
      packages: [],
      lockfile: { format: 'v13' },
      allowBuilds: { foo: true },
      patchedDependencies: { 'foo@1.0.0': 'patches/patches/foo.patch' },
    });
    expect(artifacts).toContainEqual({
      path: 'patches/patches/foo.patch',
      content: 'patch content',
    });
  });

  it('does not set v13 format when the emitted lockfile is v9', () => {
    writeFileSync(
      join(root, 'pnpm-workspace.yaml'),
      'lockfile:\n  format: v13\n'
    );
    const v9 = `lockfileVersion: '9.0'
importers:
  .: {}
`;
    const artifacts = getPrunedPnpmInstallArtifacts(root, v9, {
      name: 'app',
      version: '1.0.0',
    });
    expect(
      yaml(
        artifacts.find((a) => a.path === 'pnpm-workspace.yaml')
          .content as string
      )
    ).toEqual({ packages: [] });
  });

  it('does not set standalone format for a v13 root lockfile fallback', () => {
    const artifacts = getPrunedPnpmInstallArtifacts(
      root,
      lockfile,
      { name: 'app', version: '1.0.0' },
      { includeLocalPathArtifacts: false }
    );
    expect(
      yaml(
        artifacts.find((a) => a.path === 'pnpm-workspace.yaml')
          .content as string
      )
    ).not.toHaveProperty('lockfile');
  });

  it('keeps approvals unfiltered for a root fallback with other projects', () => {
    const rootLockfile = lockfile.replace(
      'packages:\n',
      '  apps/other: {}\npackages:\n'
    );
    expect(
      yaml(getPrunedPnpmInstallSettingsYaml(root, rootLockfile))
    ).toMatchObject({
      allowBuilds: { foo: true, absent: true },
    });
  });

  it('keeps root settings when a fallback lockfile cannot be normalized', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const rootLockfile = lockfile.replace('foo: 1.0.0', 'foo: "catalog:"');
    const artifacts = getPrunedPnpmInstallArtifacts(
      root,
      rootLockfile,
      { name: 'app', version: '1.0.0' },
      { includeLocalPathArtifacts: false }
    );
    expect(artifacts).toHaveLength(1);
    expect(yaml(artifacts[0].content as string)).toEqual({
      packages: [],
      allowBuilds: { foo: true, absent: true },
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Missing pnpm catalog')
    );
  });

  it('ships local directories, tarballs and links but excludes copied workspace modules', () => {
    for (const path of [
      'vendor/dir',
      'vendor/link',
      'vendor/transitive',
      'workspace_modules/copied',
    ]) {
      mkdirSync(join(root, path), { recursive: true });
      writeFileSync(join(root, path, 'index.js'), path);
    }
    writeFileSync(join(root, 'vendor/archive.tgz'), 'archive');
    const content = `lockfileVersion: '13.0'
projects:
  .:
    dependencies:
      linked: link:local_path_modules/vendor/link
packages:
  dir@file:local_path_modules/vendor/dir:
    dependencies:
      transitive: link:local_path_modules/vendor/transitive
  archive@file:local_path_modules/vendor/archive.tgz:
    resolution: {tarball: 'file:local_path_modules/vendor/archive.tgz'}
  copied@file:workspace_modules/copied: {}
`;
    const paths = getPrunedPnpmLocalPathArtifacts(root, content).map(
      (a) => a.path
    );
    expect(paths).toEqual(
      expect.arrayContaining([
        'local_path_modules/vendor/dir/index.js',
        'local_path_modules/vendor/link/index.js',
        'local_path_modules/vendor/transitive/index.js',
        'local_path_modules/vendor/archive.tgz',
      ])
    );
    expect(paths).not.toContain('workspace_modules/copied/index.js');
  });

  it('validates the closure of a v13 root link', () => {
    mkdirSync(join(root, 'vendor/link'), { recursive: true });
    writeFileSync(
      join(root, 'vendor/link/package.json'),
      JSON.stringify({
        name: 'linked',
        version: '1.0.0',
        dependencies: { missing: '^1.0.0' },
      })
    );
    const content = `lockfileVersion: '13.0'
projects:
  .:
    dependencies:
      linked: link:local_path_modules/vendor/link
packages: {}
`;
    expect(() =>
      validatePrunedLocalPathClosure(
        { name: 'app', version: '1.0.0' },
        root,
        content
      )
    ).toThrow(/missing/);
  });
});
