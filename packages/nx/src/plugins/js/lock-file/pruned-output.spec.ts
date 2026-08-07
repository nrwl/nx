import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { basename, dirname, join } from 'path';
import * as catalog from '../../../utils/catalog';
import { logger } from '../../../utils/logger';
import { output } from '../../../utils/output';
import type { PackageJson } from '../../../utils/package-json';
import * as pacakgeManager from '../../../utils/package-manager';
import {
  containLocalPath,
  containShippedLocalFilePaths,
  emitPrunedPnpmInstallAssets,
  getPrunedPnpmInstallSettingsYaml,
  getPrunedPnpmLocalPathArtifacts,
  getPrunedPnpmPackageJsonBuildSettings,
  getPrunedPnpmPatchArtifacts,
  normalizePrunedPatchPath,
  relocatePrunedLocalPathSpec,
  rewritePrunedLocalPathSpecifiers,
  uncontainLocalPath,
  validatePrunedLocalPathClosure,
  warnIncompletePrunedPnpmOutput,
  writePrunedPnpmInstallSettings,
} from './pruned-output';

describe('normalizePrunedPatchPath', () => {
  it.each([
    // the default patches/ layout keeps its own segment, so it cannot collide
    // with a same-named patch declared outside patches/
    ['patches/is-number.patch', 'patches/patches/is-number.patch'],
    // a custom directory keeps its subpath under patches/
    ['tools/patches/is-number.patch', 'patches/tools/patches/is-number.patch'],
    // a leading parent-relative segment is dropped, not carried outside patches/
    ['../shared/is-number.patch', 'patches/shared/is-number.patch'],
    // backslash separators (Windows-authored config) are normalized
    [
      'tools\\patches\\is-number.patch',
      'patches/tools/patches/is-number.patch',
    ],
    // an absolute path does not produce a double slash
    ['/abs/is-number.patch', 'patches/abs/is-number.patch'],
    // embedded ../ segments are dropped so the result cannot escape patches/
    ['a/../../../etc/passwd.patch', 'patches/a/etc/passwd.patch'],
  ])('maps %j to %j under patches/', (input, expected) => {
    expect(normalizePrunedPatchPath(input)).toBe(expected);
  });

  it('never lets a normalized patch path escape patches/', () => {
    for (const input of [
      '../../../etc/passwd.patch',
      'a/../../b/../../../x.patch',
      './patches/../../../x.patch',
    ]) {
      const result = normalizePrunedPatchPath(input);
      expect(result.startsWith('patches/')).toBe(true);
      expect(result.split('/')).not.toContain('..');
    }
  });
});

describe('getPrunedPnpmInstallSettingsYaml', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-settings-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function mockPnpmVersion(version: string) {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue(version);
  }

  function writeRootWorkspaceYaml(content: string) {
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), content);
  }

  it('carries allowBuilds and supportedArchitectures on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'packages:',
        '  - packages/*',
        'allowBuilds:',
        '  esbuild: true',
        'supportedArchitectures:',
        '  os:',
        '    - linux',
        '',
      ].join('\n')
    );

    const yaml = getPrunedPnpmInstallSettingsYaml(tempDir);

    expect(yaml).not.toBeNull();
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true },
      supportedArchitectures: { os: ['linux'] },
    });
    // Never carry the root packages glob, but declare an empty list: pnpm 9
    // rejects a pnpm-workspace.yaml without a `packages` field, and `packages: []`
    // installs on pnpm 9-11 without pulling any importer into the install.
    expect(yaml).toContain('packages: []');
    expect(yaml).not.toContain('packages/*');
  });

  it('returns null on pnpm 10 (those settings are read from package.json)', () => {
    mockPnpmVersion('10.5.0');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('carries settings on pnpm 12 and above (same behavior as pnpm 11)', () => {
    mockPnpmVersion('12.0.0');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    const yaml = getPrunedPnpmInstallSettingsYaml(tempDir);

    expect(yaml).not.toBeNull();
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true },
    });
  });

  it('returns null when the workspace has no root pnpm-workspace.yaml', () => {
    mockPnpmVersion('11.2.2');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when pnpm 11 declares no install-time settings', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('packages:\n  - packages/*\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('fails open (null) when the pnpm version cannot be determined', () => {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockImplementation(() => {
        throw new Error('no pnpm on PATH');
      });
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('fails open (null) when the root pnpm-workspace.yaml is malformed', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds: { esbuild: true');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when the root pnpm-workspace.yaml is empty', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('returns null when the root pnpm-workspace.yaml has only comments', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('# no install-time settings here\n');

    expect(getPrunedPnpmInstallSettingsYaml(tempDir)).toBeNull();
  });

  it('detects the pnpm version once per workspace root across writes', () => {
    // The bundler plugins emit once per compilation, and resolving the version
    // re-reads the root manifest and can shell out to `pnpm --version`.
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-memo-'));
    try {
      writeFileSync(
        join(workspaceRoot, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n'
      );
      const outputDir = join(workspaceRoot, 'dist');
      mkdirSync(outputDir);
      const readVersion = jest
        .spyOn(pacakgeManager, 'getPackageManagerVersion')
        .mockReturnValue('11.2.2');

      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);
      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);

      expect(readVersion).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('retries the pnpm version after a failed detection', () => {
    // getPackageManagerVersion throws when it has to shell out and the spawn
    // fails, which is transient. Remembering that would drop the settings from
    // every later prune in the process.
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-retry-'));
    try {
      writeFileSync(
        join(workspaceRoot, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n'
      );
      const outputDir = join(workspaceRoot, 'dist');
      mkdirSync(outputDir);
      jest
        .spyOn(pacakgeManager, 'getPackageManagerVersion')
        .mockImplementationOnce(() => {
          throw new Error('spawn pnpm EAGAIN');
        })
        .mockReturnValue('11.2.2');

      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);
      expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);

      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);
      expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(true);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('skips the settings file on pnpm 10', () => {
    // A separate workspace root per pnpm major: the detected version is
    // memoized per root, as it is for the duration of a real process.
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-10-'));
    try {
      writeFileSync(
        join(workspaceRoot, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n'
      );
      const outputDir = join(workspaceRoot, 'dist');
      mkdirSync(outputDir);
      mockPnpmVersion('10.5.0');

      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);

      expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('writes the settings file on pnpm 11', () => {
    const workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-11-'));
    try {
      writeFileSync(
        join(workspaceRoot, 'pnpm-workspace.yaml'),
        'allowBuilds:\n  esbuild: true\n'
      );
      const outputDir = join(workspaceRoot, 'dist');
      mkdirSync(outputDir);
      const outputFile = join(outputDir, 'pnpm-workspace.yaml');
      mockPnpmVersion('11.2.2');

      writePrunedPnpmInstallSettings(outputDir, workspaceRoot);

      expect(existsSync(outputFile)).toBe(true);
      const { load } = require('@zkochan/js-yaml');
      expect(load(readFileSync(outputFile, 'utf-8'))).toEqual({
        packages: [],
        allowBuilds: { esbuild: true },
      });
    } finally {
      rmSync(workspaceRoot, { recursive: true, force: true });
    }
  });

  const prunedLockfileWith = (...packageKeys: string[]) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      ...packageKeys.flatMap((key) => [
        // pnpm quotes keys that start with `@` (a reserved YAML indicator)
        `  ${key.startsWith('@') ? `'${key}'` : key}:`,
        '    resolution: {integrity: sha512-abc}',
        '',
      ]),
    ].join('\n');

  // createLockFile's fallback ships this instead: the workspace's projects sit
  // under `importers`, and only third-party deps reach `packages`.
  const rootLockfileWithImporters = () =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .: {}',
      '',
      '  packages/lib: {}',
      '',
      'packages:',
      '',
      '  lodash@4.17.21:',
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

  it('scopes allowBuilds to the packages present in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'allowBuilds:',
        '  esbuild: true',
        "  '@parcel/watcher': true",
        '  some-absent-native-dep: true',
        '',
      ].join('\n')
    );

    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      prunedLockfileWith('esbuild@0.21.5', '@parcel/watcher@2.4.1')
    );

    const { load } = require('@zkochan/js-yaml');
    // the entry for the package the prune dropped is left out
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true, '@parcel/watcher': true },
    });
  });

  it('drops allowBuilds when no approved package is in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  some-absent-native-dep: true\n');

    expect(
      getPrunedPnpmInstallSettingsYaml(
        tempDir,
        prunedLockfileWith('lodash@4.17.21')
      )
    ).toBeNull();
  });

  // Valid YAML that is not a lockfile document. Each case needs its own content,
  // since the parse is memoized (see the unparseable case below).
  it.each([
    ['a scalar', 'NOT_A_LOCKFILE_DOCUMENT'],
    ['a sequence', '- packages\n- snapshots'],
  ])('warns when the pruned lockfile parses to %s', (_kind, content) => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const yaml = getPrunedPnpmInstallSettingsYaml(tempDir, content);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('does not parse to a YAML mapping')
    );
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true },
    });
  });

  it('warns when the pruned lockfile carries no document after its start marker', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    // Opens a YAML document and never separates a second one, so the extraction
    // is empty and used to read back as an empty lockfile.
    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      "---\nlockfileVersion: '9.0'\n"
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('carries no lockfile document')
    );
    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true },
    });
  });

  it('carries allowBuilds verbatim when the pruned lockfile is unparseable', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    // Distinct from the other unparseable-lockfile cases: the parse is memoized
    // on content, so shared content would warn only on whichever runs first.
    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      'allowBuilds: [broken: yaml'
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Could not parse the pnpm lockfile')
    );
    const { load } = require('@zkochan/js-yaml');
    // Scoping needs the lockfile's package names; without them, dropping an
    // approval silently skips a needed build script, so carry them all.
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { esbuild: true },
    });
  });

  it('carries allowBuilds verbatim when the fallback ships the root lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml("allowBuilds:\n  '@myorg/lib': true\n");

    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      rootLockfileWithImporters()
    );

    const { load } = require('@zkochan/js-yaml');
    // A workspace project is an importer and never a `packages` entry, so
    // scoping against the root lockfile would drop the approval for the
    // workspace module the output ships as a file: directory dependency, which
    // pnpm does gate on the approval list.
    expect(load(yaml)).toEqual({
      packages: [],
      allowBuilds: { '@myorg/lib': true },
    });
  });

  it('honors a precomputed null pnpm major instead of re-probing', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');

    // null means the probe already failed (and warned); re-probing here could
    // disagree with the decisions the other builders derived from that null.
    expect(
      getPrunedPnpmInstallSettingsYaml(tempDir, undefined, {
        pnpmMajor: null,
        patchedDependencies: {},
      })
    ).toBeNull();
  });

  it('scopes allowBuilds using the pruned lockfile written to the output dir', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'allowBuilds:\n  esbuild: true\n  some-absent-native-dep: true\n'
    );
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'pnpm-lock.yaml'),
      prunedLockfileWith('esbuild@0.21.5')
    );

    writePrunedPnpmInstallSettings(outputDir, tempDir);

    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ packages: [], allowBuilds: { esbuild: true } });
  });

  it('removes a stale settings file when the pruned output no longer has settings', () => {
    mockPnpmVersion('11.2.2');
    // Root once approved a build script, so a prior deploy wrote settings out.
    writeRootWorkspaceYaml('allowBuilds:\n  some-absent-native-dep: true\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    const outputFile = join(outputDir, 'pnpm-workspace.yaml');
    // Leftover from that earlier deploy (a cache replay restores only the files
    // the newer entry holds, so an emptied settings set leaves this behind).
    writeFileSync(outputFile, 'allowBuilds:\n  some-absent-native-dep: true\n');

    // The current pruned lockfile approves nothing, so there are no settings.
    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('lodash@4.17.21')
    );

    expect(existsSync(outputFile)).toBe(false);
  });

  it('prefers passed lockfile content over re-reading it from disk', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      ['allowBuilds:', '  esbuild: true', "  '@parcel/watcher': true", ''].join(
        '\n'
      )
    );
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    // A stale on-disk lockfile the caller's in-memory content supersedes.
    writeFileSync(
      join(outputDir, 'pnpm-lock.yaml'),
      prunedLockfileWith('esbuild@0.21.5')
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('@parcel/watcher@2.4.1')
    );

    const { load } = require('@zkochan/js-yaml');
    // Scoped to the passed content (@parcel/watcher), not the on-disk esbuild.
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ packages: [], allowBuilds: { '@parcel/watcher': true } });
  });

  // A pruned lockfile carrying a patchedDependencies section (values are the
  // patch hashes; only the keys drive scoping).
  const prunedLockfileWithPatches = (
    packageKeys: string[],
    patchKeys: string[]
  ) =>
    [
      prunedLockfileWith(...packageKeys),
      'patchedDependencies:',
      ...patchKeys.map(
        (key) => `  ${key.startsWith('@') ? `'${key}'` : key}: hash-${key}`
      ),
      '',
    ].join('\n');

  function writeRootPatch(patchPath: string, content = 'PATCH\n') {
    const full = join(tempDir, patchPath);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  it('carries patchedDependencies in the pnpm 11 yaml, scoped to surviving packages', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/is-number@7.0.0.patch',
        '  left-pad@1.0.0: patches/left-pad@1.0.0.patch',
        '',
      ].join('\n')
    );

    // only is-number survives the prune
    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
      },
    });
  });

  it('carries pnpm-workspace.yaml patchedDependencies when the root package.json is unreadable', () => {
    mockPnpmVersion('11.2.2');
    writeFileSync(join(tempDir, 'package.json'), '{ not json');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );

    const yaml = getPrunedPnpmInstallSettingsYaml(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(yaml)).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
      },
    });
  });

  it('carries a name-only (unversioned) patch key scoped to the surviving package', () => {
    mockPnpmVersion('11.2.2');
    // A name-only key patches every version; the lockfile records it under the
    // bare name while the package key stays versioned. The scope must still
    // match the two against the shared root config key.
    writeRootWorkspaceYaml(
      ['patchedDependencies:', '  is-number: patches/is-number.patch', ''].join(
        '\n'
      )
    );
    writeRootPatch('patches/is-number.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/patches/is-number.patch', content: 'THE PATCH\n' },
    ]);
  });

  it('carries a semver-range patch key scoped to the surviving package', () => {
    mockPnpmVersion('11.2.2');
    // A range key patches every matching version; the pruned lockfile keeps the
    // range key verbatim, so the scope matches it against the shared root config
    // key.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@^7.0.0: patches/is-number@7.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@^7.0.0'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/patches/is-number@7.patch', content: 'THE PATCH\n' },
    ]);
  });

  it('ships patch files and keeps patchedDependencies out of package.json on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([
      { path: 'patches/patches/is-number@7.0.0.patch', content: 'THE PATCH\n' },
    ]);
    // pnpm 11 carries the declaration in pnpm-workspace.yaml, not package.json
    expect(packageJsonPatchedDependencies).toBeNull();
  });

  it('reads the patch scope from a two-document pnpm 11 lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');
    // The prune falls back to the root lockfile on a pruning error, and pnpm 11
    // writes that lockfile as two documents for a package manager it persists.
    const lockfile = [
      '---',
      'packageManager: pnpm@11.2.2',
      '---',
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0']),
    ].join('\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(tempDir, lockfile);

    expect(patchFiles).toEqual([
      { path: 'patches/patches/is-number@7.0.0.patch', content: 'THE PATCH\n' },
    ]);
  });

  it('declares patchedDependencies in package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    // pnpm <=10 reads the config from the package.json pnpm field
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toHaveLength(1);
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
    });
  });

  it('relocates a custom patch path under patches/ preserving its subpath in the pnpm 11 yaml and files', () => {
    mockPnpmVersion('11.2.2');
    // A workspace can keep patches outside patches/ (custom or shared dir). The
    // pruned output relocates them under patches/ with their subpath preserved,
    // so the prune target's declared `patches` output covers them; otherwise a
    // cache replay drops the file and the standalone install fails on the
    // missing patch.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: tools/patches/is-number.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('tools/patches/is-number.patch', 'THE PATCH\n');

    const lockfile = prunedLockfileWithPatches(
      ['is-number@7.0.0'],
      ['is-number@7.0.0']
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(getPrunedPnpmInstallSettingsYaml(tempDir, lockfile))).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/tools/patches/is-number.patch',
      },
    });

    const { patchFiles } = getPrunedPnpmPatchArtifacts(tempDir, lockfile);
    // Read from the custom source, shipped under patches/ with its subpath kept.
    expect(patchFiles).toEqual([
      {
        path: 'patches/tools/patches/is-number.patch',
        content: 'THE PATCH\n',
      },
    ]);
  });

  it('ships a patch referenced by an absolute config path', () => {
    mockPnpmVersion('11.2.2');
    // pnpm accepts an absolute patchedDependencies path even though its own
    // patch-commit writes relative ones. The config/lockfile side already maps
    // it under patches/, so the file must ship from its absolute source or the
    // standalone install would reference a patch that was never copied in.
    const absolutePatchPath = join(tempDir, 'patches', 'is-number@7.0.0.patch');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        `  is-number@7.0.0: ${absolutePatchPath}`,
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles).toHaveLength(1);
    expect(patchFiles[0].content).toBe('THE PATCH\n');
    expect(patchFiles[0].path.startsWith('patches/')).toBe(true);
    expect(patchFiles[0].path.endsWith('/is-number@7.0.0.patch')).toBe(true);
  });

  it('relocates a custom patch path under patches/ preserving its subpath in the package.json declaration on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'custom/is-number.patch',
          },
        },
      })
    );
    writeRootPatch('custom/is-number.patch');

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([
      { path: 'patches/custom/is-number.patch', content: 'PATCH\n' },
    ]);
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/custom/is-number.patch',
    });
  });

  it('keeps same-named patches in different directories from colliding under patches/', () => {
    mockPnpmVersion('11.2.2');
    // Two patches sharing a file name in different source directories must land
    // at distinct paths under patches/, or one would overwrite the other and the
    // install would apply the wrong patch (or fail the hash check).
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: a/fix.patch',
        '  is-odd@3.0.1: b/fix.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('a/fix.patch', 'PATCH A\n');
    writeRootPatch('b/fix.patch', 'PATCH B\n');

    const lockfile = prunedLockfileWithPatches(
      ['is-number@7.0.0', 'is-odd@3.0.1'],
      ['is-number@7.0.0', 'is-odd@3.0.1']
    );

    const { load } = require('@zkochan/js-yaml');
    expect(load(getPrunedPnpmInstallSettingsYaml(tempDir, lockfile))).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/a/fix.patch',
        'is-odd@3.0.1': 'patches/b/fix.patch',
      },
    });

    const { patchFiles } = getPrunedPnpmPatchArtifacts(tempDir, lockfile);
    expect(patchFiles).toEqual([
      { path: 'patches/a/fix.patch', content: 'PATCH A\n' },
      { path: 'patches/b/fix.patch', content: 'PATCH B\n' },
    ]);
  });

  it('scopes patch artifacts to the packages in the pruned lockfile', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/is-number@7.0.0.patch',
        '  left-pad@1.0.0: patches/left-pad@1.0.0.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number@7.0.0.patch');
    writeRootPatch('patches/left-pad@1.0.0.patch');

    // left-pad is not present in the pruned lockfile
    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles.map((file) => file.path)).toEqual([
      'patches/patches/is-number@7.0.0.patch',
    ]);
  });

  it('warns but keeps the declaration when a patch source file is missing', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    // The patch file is intentionally NOT written to disk.
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
      );

    expect(patchFiles).toEqual([]);
    // The declaration is kept: dropping only it would mismatch the pruned
    // lockfile, which still lists the patch.
    expect(packageJsonPatchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('patches/is-number@7.0.0.patch')
    );
    warn.mockRestore();
  });

  it('returns no patch artifacts when the pruned lockfile has no patches', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );

    const { patchFiles, packageJsonPatchedDependencies } =
      getPrunedPnpmPatchArtifacts(
        tempDir,
        prunedLockfileWith('is-number@7.0.0')
      );

    expect(patchFiles).toEqual([]);
    expect(packageJsonPatchedDependencies).toBeNull();
  });

  it('copies patch files and declares them in package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'PATCH BODY\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', version: '0.0.1' })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    // pnpm 10 reads no pnpm-workspace.yaml
    expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);
    // the patch file is copied preserving its relative path
    expect(
      readFileSync(
        join(outputDir, 'patches/patches/is-number@7.0.0.patch'),
        'utf-8'
      )
    ).toBe('PATCH BODY\n');
    // and the declaration lands in the emitted package.json
    const manifest = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(manifest.pnpm.patchedDependencies).toEqual({
      'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
    });
  });

  it('carries patches in the yaml and leaves package.json untouched on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', version: '0.0.1' })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
      },
    });
    expect(
      existsSync(join(outputDir, 'patches/patches/is-number@7.0.0.patch'))
    ).toBe(true);
    // pnpm 11 ignores the package.json pnpm field, so it stays as emitted
    const manifest = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(manifest.pnpm).toBeUndefined();
  });

  // emitPrunedPnpmInstallAssets is the sink-based sibling the bundler plugins
  // (webpack, rspack) use: it emits the same artifacts writePrunedPnpmInstallSettings
  // writes, but through a caller callback and mutating the in-memory manifest.
  it('emits the pnpm-workspace.yaml and patch files and leaves package.json untouched on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');
    const packageJson: PackageJson = { name: 'app', version: '0.0.1' };
    const emitted: Array<{ path: string; content: string | Buffer }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0']),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    const { load } = require('@zkochan/js-yaml');
    const yamlAsset = emitted.find((a) => a.path === 'pnpm-workspace.yaml');
    expect(load(yamlAsset.content)).toEqual({
      packages: [],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
      },
    });
    expect(emitted).toContainEqual({
      path: 'patches/patches/is-number@7.0.0.patch',
      content: 'THE PATCH\n',
    });
    // pnpm 11 carries the declaration in pnpm-workspace.yaml, not package.json
    expect(packageJson.pnpm).toBeUndefined();
  });

  it('emits each artifact exactly once', () => {
    // The sink appends, so a double emit would ship a duplicate asset rather
    // than overwrite one, and the bundlers reject a duplicate emit outright.
    // Both producers are given a genuine duplicate to collapse: two patch keys
    // sharing one patch file, and one vendored directory reached as a `file:`
    // package and as a `link:` importer ref.
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/is-number.patch',
        '  is-number@7.0.1: patches/is-number.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/is-number.patch', 'THE PATCH\n');
    mkdirSync(join(tempDir, 'vendor/lib'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/lib/index.js'), 'REAL');
    const emit = jest.fn();

    emitPrunedPnpmInstallAssets(
      tempDir,
      [
        "lockfileVersion: '9.0'",
        '',
        'importers:',
        '',
        '  .:',
        '    dependencies:',
        '      linked-lib:',
        '        specifier: link:local_path_modules/vendor/lib',
        '        version: link:local_path_modules/vendor/lib',
        '',
        'packages:',
        '',
        '  is-number@7.0.0:',
        '    resolution: {integrity: sha512-abc}',
        '  is-number@7.0.1:',
        '    resolution: {integrity: sha512-def}',
        '  lib@file:local_path_modules/vendor/lib:',
        '    resolution: {directory: local_path_modules/vendor/lib, type: directory}',
        '',
        'patchedDependencies:',
        '  is-number@7.0.0: hash-is-number-0',
        '  is-number@7.0.1: hash-is-number-1',
        '',
      ].join('\n'),
      { name: 'app', version: '0.0.1' },
      emit,
      { includeLocalPathArtifacts: true }
    );

    const paths = emit.mock.calls.map(([path]) => path);
    expect(paths).toEqual([...new Set(paths)]);
    expect(paths).toEqual(
      expect.arrayContaining([
        'pnpm-workspace.yaml',
        'patches/patches/is-number.patch',
        'local_path_modules/vendor/lib/index.js',
      ])
    );
  });

  it('ships the patch file and folds patchedDependencies into the in-memory manifest on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: {
            'is-number@7.0.0': 'patches/is-number@7.0.0.patch',
          },
        },
      })
    );
    writeRootPatch('patches/is-number@7.0.0.patch', 'THE PATCH\n');
    // an existing pnpm field must survive the fold, not be replaced
    const packageJson: PackageJson = {
      name: 'app',
      version: '0.0.1',
      pnpm: { onlyBuiltDependencies: ['esbuild'] },
    };
    const emitted: Array<{ path: string; content: string | Buffer }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0']),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    // pnpm <=10 has no pnpm-workspace.yaml; only the patch file is emitted
    expect(emitted).toEqual([
      { path: 'patches/patches/is-number@7.0.0.patch', content: 'THE PATCH\n' },
    ]);
    expect(packageJson.pnpm).toEqual({
      onlyBuiltDependencies: ['esbuild'],
      patchedDependencies: {
        'is-number@7.0.0': 'patches/patches/is-number@7.0.0.patch',
      },
    });
  });

  it('emits nothing and leaves package.json untouched when there are no pnpm install settings', () => {
    mockPnpmVersion('11.2.2');
    const packageJson: PackageJson = { name: 'app', version: '0.0.1' };
    const emitted: Array<{ path: string; content: string | Buffer }> = [];

    emitPrunedPnpmInstallAssets(
      tempDir,
      prunedLockfileWith('is-number@7.0.0'),
      packageJson,
      (path, content) => emitted.push({ path, content })
    );

    expect(emitted).toEqual([]);
    expect(packageJson.pnpm).toBeUndefined();
  });

  it('ships a same-named patch from inside and outside patches/ separately', () => {
    mockPnpmVersion('11.2.2');
    // `patches/dupe.patch` and `dupe.patch` are different files. The shipped
    // path keeps the whole source subpath, so they land apart instead of one
    // overwriting the other.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/dupe.patch',
        '  is-odd@3.0.1: dupe.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/dupe.patch', 'A\n');
    writeRootPatch('dupe.patch', 'B\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(
        ['is-number@7.0.0', 'is-odd@3.0.1'],
        ['is-number@7.0.0', 'is-odd@3.0.1']
      )
    );

    expect(patchFiles).toEqual(
      expect.arrayContaining([
        { path: 'patches/patches/dupe.patch', content: 'A\n' },
        { path: 'patches/dupe.patch', content: 'B\n' },
      ])
    );
  });

  it('throws when two patch sources still alias to one shipped path', () => {
    mockPnpmVersion('11.2.2');
    // Dropping `..` segments is what keeps a shipped path inside patches/, and
    // it is the one way two distinct sources can still meet: a path that
    // escapes the workspace and an in-workspace one with the same tail.
    // Shipping one file for both would apply the wrong patch, so fail loudly.
    const siblingName = `nx-pruned-alias-${basename(tempDir)}`;
    const outsideDir = join(dirname(tempDir), siblingName);
    try {
      mkdirSync(outsideDir, { recursive: true });
      writeFileSync(join(outsideDir, 'dupe.patch'), 'A\n');
      writeRootPatch(`${siblingName}/dupe.patch`, 'B\n');
      writeRootWorkspaceYaml(
        [
          'patchedDependencies:',
          `  is-number@7.0.0: ../${siblingName}/dupe.patch`,
          `  is-odd@3.0.1: ${siblingName}/dupe.patch`,
          '',
        ].join('\n')
      );

      expect(() =>
        getPrunedPnpmPatchArtifacts(
          tempDir,
          prunedLockfileWithPatches(
            ['is-number@7.0.0', 'is-odd@3.0.1'],
            ['is-number@7.0.0', 'is-odd@3.0.1']
          )
        )
      ).toThrow(/both ship to "patches\//);
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('ships a single file when two keys reference the same patch', () => {
    mockPnpmVersion('11.2.2');
    // Two keys sharing one patch file is not a collision: the same source ships
    // once.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/shared.patch',
        '  is-number@7.0.1: patches/shared.patch',
        '',
      ].join('\n')
    );
    writeRootPatch('patches/shared.patch', 'SHARED\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(
        ['is-number@7.0.0', 'is-number@7.0.1'],
        ['is-number@7.0.0', 'is-number@7.0.1']
      )
    );

    expect(patchFiles).toEqual([
      { path: 'patches/patches/shared.patch', content: 'SHARED\n' },
    ]);
  });

  it('prefers the pnpm-workspace.yaml patch path over a stale package.json one', () => {
    mockPnpmVersion('11.2.2');
    // The same key in both root sources with different paths. pnpm-workspace.yaml
    // is authoritative on pnpm 11, so its path (and file) must win.
    writeRootWorkspaceYaml(
      [
        'patchedDependencies:',
        '  is-number@7.0.0: patches/current.patch',
        '',
      ].join('\n')
    );
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        pnpm: {
          patchedDependencies: { 'is-number@7.0.0': 'patches/stale.patch' },
        },
      })
    );
    writeRootPatch('patches/current.patch', 'CURRENT\n');
    writeRootPatch('patches/stale.patch', 'STALE\n');

    const { patchFiles } = getPrunedPnpmPatchArtifacts(
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    expect(patchFiles).toEqual([
      { path: 'patches/patches/current.patch', content: 'CURRENT\n' },
    ]);
  });

  it('resolves the pnpm version once per write even when shipping patches', () => {
    const versionSpy = jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('11.2.2');
    writeRootWorkspaceYaml(
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number.patch\n'
    );
    writeRootPatch('patches/is-number.patch');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWithPatches(['is-number@7.0.0'], ['is-number@7.0.0'])
    );

    // The pnpm major is resolved once at the entry point and threaded into both
    // builders, not re-detected inside each.
    expect(versionSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getPrunedPnpmPackageJsonBuildSettings', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-build-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function mockPnpmVersion(version: string) {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue(version);
  }
  function writeRootWorkspaceYaml(content: string) {
    writeFileSync(join(tempDir, 'pnpm-workspace.yaml'), content);
  }
  function writeRootPackageJson(pnpm: Record<string, unknown>) {
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ pnpm }));
  }
  const prunedLockfileWith = (...packageKeys: string[]) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      ...packageKeys.flatMap((key) => [
        `  ${key.startsWith('@') ? `'${key}'` : key}:`,
        '    resolution: {integrity: sha512-abc}',
        '',
      ]),
    ].join('\n');

  it('returns null on pnpm 11 (build approvals go to pnpm-workspace.yaml)', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('carries onlyBuiltDependencies from pnpm-workspace.yaml on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('carries onlyBuiltDependencies from the root package.json pnpm field on pnpm 9', () => {
    mockPnpmVersion('9.15.9');
    // pnpm 9 reads build approvals only from the package.json pnpm field.
    writeRootPackageJson({ onlyBuiltDependencies: ['esbuild'] });

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('folds a root allowBuilds map into on/never-built lists (pnpm 10.26+)', () => {
    mockPnpmVersion('10.26.0');
    writeRootWorkspaceYaml(
      'allowBuilds:\n  esbuild: true\n  telemetry-dep: false\n'
    );

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
      neverBuiltDependencies: ['telemetry-dep'],
    });
  });

  it('scopes approvals to the packages present in the pruned lockfile', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml(
      'onlyBuiltDependencies:\n  - esbuild\n  - some-absent-native-dep\n'
    );

    expect(
      getPrunedPnpmPackageJsonBuildSettings(
        tempDir,
        prunedLockfileWith('esbuild@0.21.5')
      )
    ).toEqual({ onlyBuiltDependencies: ['esbuild'] });
  });

  it('carries approvals verbatim when the fallback ships the root lockfile', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml(
      'onlyBuiltDependencies:\n  - "@myorg/lib"\n  - some-absent-native-dep\n'
    );

    // The root lockfile lists workspace projects under `importers`, so scoping
    // against it would drop the approval for the workspace module the output
    // ships as a file: directory dependency.
    const rootLockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .: {}',
      '',
      '  packages/lib: {}',
      '',
      'packages:',
      '',
      '  lodash@4.17.21:',
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmPackageJsonBuildSettings(tempDir, rootLockfile)
    ).toEqual({
      onlyBuiltDependencies: ['@myorg/lib', 'some-absent-native-dep'],
    });
  });

  it('carries approvals verbatim for a pre-v9 lockfile instead of scoping', () => {
    mockPnpmVersion('8.15.9');
    writeRootPackageJson({
      onlyBuiltDependencies: ['esbuild', 'some-absent-native-dep'],
    });

    // v6 keys (`/name@version`) do not parse as v9 `name@version`, so scoping
    // would drop every approval; carry them verbatim instead (inert direction).
    const v6Lockfile = [
      "lockfileVersion: '6.0'",
      '',
      'packages:',
      '',
      '  /esbuild@0.21.5:',
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir, v6Lockfile)).toEqual({
      onlyBuiltDependencies: ['esbuild', 'some-absent-native-dep'],
    });
  });

  it('carries approvals verbatim when the pruned lockfile is unparseable', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(
      getPrunedPnpmPackageJsonBuildSettings(tempDir, 'not: [valid: yaml')
    ).toEqual({ onlyBuiltDependencies: ['esbuild'] });
  });

  it('honors a precomputed null pnpm major instead of re-probing', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(
      getPrunedPnpmPackageJsonBuildSettings(tempDir, undefined, {
        pnpmMajor: null,
        patchedDependencies: {},
      })
    ).toBeNull();
  });

  it('carries supportedArchitectures', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml(
      'supportedArchitectures:\n  os:\n    - linux\n  cpu:\n    - x64\n'
    );

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      supportedArchitectures: { os: ['linux'], cpu: ['x64'] },
    });
  });

  it('lets pnpm-workspace.yaml win over the root package.json per field', () => {
    mockPnpmVersion('10.13.1');
    writeRootPackageJson({ onlyBuiltDependencies: ['from-package-json'] });
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - from-workspace-yaml\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['from-workspace-yaml'],
    });
  });

  it('returns null when the workspace declares no build approvals', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('packages:\n  - packages/*\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('carries pnpm-workspace.yaml settings when the root package.json is unreadable', () => {
    mockPnpmVersion('10.13.1');
    writeFileSync(join(tempDir, 'package.json'), '{ not json');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('carries root package.json settings when pnpm-workspace.yaml is unreadable', () => {
    mockPnpmVersion('9.15.9');
    writeRootPackageJson({ onlyBuiltDependencies: ['esbuild'] });
    writeRootWorkspaceYaml('onlyBuiltDependencies: [unclosed');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toEqual({
      onlyBuiltDependencies: ['esbuild'],
    });
  });

  it('fails open (null) when the pnpm version cannot be determined', () => {
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockImplementation(() => {
        throw new Error('no pnpm on PATH');
      });
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');

    expect(getPrunedPnpmPackageJsonBuildSettings(tempDir)).toBeNull();
  });

  it('folds build approvals into the emitted package.json on pnpm 10', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { esbuild: '0.21.5' } })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(pkg.pnpm).toEqual({ onlyBuiltDependencies: ['esbuild'] });
    // pnpm <=10 reads these from package.json, so no workspace file is written.
    expect(existsSync(join(outputDir, 'pnpm-workspace.yaml'))).toBe(false);
  });

  it('keeps build approvals out of the emitted package.json on pnpm 11', () => {
    mockPnpmVersion('11.2.2');
    writeRootWorkspaceYaml('allowBuilds:\n  esbuild: true\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({ name: 'app', dependencies: { esbuild: '0.21.5' } })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(pkg.pnpm).toBeUndefined();
    const { load } = require('@zkochan/js-yaml');
    expect(
      load(readFileSync(join(outputDir, 'pnpm-workspace.yaml'), 'utf-8'))
    ).toEqual({ packages: [], allowBuilds: { esbuild: true } });
  });

  it('unions a project-level approval with the carried one', () => {
    mockPnpmVersion('10.13.1');
    writeRootWorkspaceYaml('onlyBuiltDependencies:\n  - esbuild\n');
    const outputDir = join(tempDir, 'dist');
    mkdirSync(outputDir);
    writeFileSync(
      join(outputDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        pnpm: { onlyBuiltDependencies: ['app-native'] },
        dependencies: { esbuild: '0.21.5', 'app-native': '1.0.0' },
      })
    );

    writePrunedPnpmInstallSettings(
      outputDir,
      tempDir,
      prunedLockfileWith('esbuild@0.21.5', 'app-native@1.0.0')
    );

    const pkg = JSON.parse(
      readFileSync(join(outputDir, 'package.json'), 'utf-8')
    );
    expect(new Set(pkg.pnpm.onlyBuiltDependencies)).toEqual(
      new Set(['app-native', 'esbuild'])
    );
  });
});

describe('getPrunedPnpmLocalPathArtifacts', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-pnpm-tarball-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const lockfileWithTarball = (tarballSpec: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      `  vendored-lib@${tarballSpec}:`,
      `    resolution: {integrity: sha512-abc, tarball: ${tarballSpec}}`,
      '',
    ].join('\n');

  it('ships a file: tarball vendored inside the workspace', () => {
    mkdirSync(join(tempDir, 'vendor'));
    const bytes = Buffer.from([0, 1, 2, 3]);
    writeFileSync(join(tempDir, 'vendor/vendored-lib-1.0.0.tgz'), bytes);

    const artifacts = getPrunedPnpmLocalPathArtifacts(
      tempDir,
      lockfileWithTarball('file:vendor/vendored-lib-1.0.0.tgz')
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].path).toBe('vendor/vendored-lib-1.0.0.tgz');
    expect(readFileSync(artifacts[0].sourcePath).equals(bytes)).toBe(true);
  });

  it('reads a workspace directory named after the shipped directory from its own tree', () => {
    // The shipped path of a workspace package that already sits under
    // local_path_modules/ is doubly prefixed, so resolving it back must land on
    // the real source rather than on a same-named directory at the root.
    mkdirSync(join(tempDir, 'local_path_modules/lib'), { recursive: true });
    writeFileSync(join(tempDir, 'local_path_modules/lib/index.js'), 'REAL');
    mkdirSync(join(tempDir, 'lib'), { recursive: true });
    writeFileSync(join(tempDir, 'lib/index.js'), 'DECOY');
    const shippedPath = containLocalPath('local_path_modules/lib');

    const artifacts = getPrunedPnpmLocalPathArtifacts(
      tempDir,
      [
        "lockfileVersion: '9.0'",
        '',
        'packages:',
        '',
        `  lib@file:${shippedPath}:`,
        `    resolution: {directory: ${shippedPath}, type: directory}`,
        '',
      ].join('\n')
    );

    expect(artifacts).toEqual([
      {
        path: `${shippedPath}/index.js`,
        sourcePath: join(tempDir, 'local_path_modules/lib/index.js'),
      },
    ]);
    expect(readFileSync(artifacts[0].sourcePath, 'utf-8')).toBe('REAL');
  });

  it('does not ship an https tarball', () => {
    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('https://example.com/vendored-lib-1.0.0.tgz')
      )
    ).toEqual([]);
  });

  it('does not ship a copied workspace module (directory resolution)', () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      "  '@scope/lib@file:workspace_modules/@scope/lib':",
      '    resolution: {directory: workspace_modules/@scope/lib, type: directory}',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
  });

  it('warns and skips a tarball resolved outside the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('file:../external/vendored-lib-1.0.0.tgz')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a tarball missing on disk', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        lockfileWithTarball('file:vendor/missing.tgz')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found'));
  });

  it('ships a file: directory tree and filters node_modules', () => {
    mkdirSync(join(tempDir, 'vendor/dir/nested'), { recursive: true });
    mkdirSync(join(tempDir, 'vendor/dir/node_modules'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/dir/index.js'), 'module.exports={}');
    writeFileSync(join(tempDir, 'vendor/dir/nested/util.js'), 'exports.x=1');
    writeFileSync(join(tempDir, 'vendor/dir/node_modules/junk.js'), 'junk');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    resolution: {directory: vendor/dir, type: directory}',
      '',
    ].join('\n');

    const paths = getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)
      .map((a) => a.path)
      .sort();
    expect(paths).toEqual(['vendor/dir/index.js', 'vendor/dir/nested/util.js']);
  });

  it('ships a root importer link: target tree', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([
      {
        path: 'vendor/linked/index.js',
        sourcePath: join(tempDir, 'vendor/linked/index.js'),
      },
    ]);
  });

  it('ships a copied module link: snapshot target', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    resolution: {directory: workspace_modules/mylib, type: directory}',
      '',
      'snapshots:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    dependencies:',
      '      linked-lib: link:vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
  });

  it('does not ship a link: that points into workspace_modules', () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      my-workspace-lib:',
      '        specifier: link:workspace_modules/my-workspace-lib',
      '        version: link:workspace_modules/my-workspace-lib',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
  });

  it('dedups a target referenced by both the importer and a copied module', () => {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
      'packages:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    resolution: {directory: workspace_modules/mylib, type: directory}',
      '',
      'snapshots:',
      '',
      '  mylib@file:workspace_modules/mylib:',
      '    dependencies:',
      '      linked-lib: link:vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
  });

  it('warns and skips a link: target resolved outside the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:../external/linked',
      '        version: link:../external/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a link: target missing on disk', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/ghost',
      '        version: link:vendor/ghost',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found'));
  });

  it('warns and skips an absolute link: target instead of rebasing it under the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    // A same-named directory inside the workspace must not be shipped in its place.
    mkdirSync(join(tempDir, 'opt/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'opt/linked/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:/opt/linked',
      '        version: link:/opt/linked',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('warns and skips a link: target that resolves to the workspace root itself', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeFileSync(join(tempDir, 'file-at-root.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      root-pkg:',
      '        specifier: link:.',
      '        version: link:.',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('workspace root itself')
    );
  });

  it('ships a link: target referenced from a vendored file: directory snapshot', () => {
    mkdirSync(join(tempDir, 'vendor/dir'), { recursive: true });
    mkdirSync(join(tempDir, 'vendor/helper'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/dir/index.js'), 'module.exports={}');
    writeFileSync(join(tempDir, 'vendor/helper/index.js'), 'exports.h=1');

    // pnpm reads a snapshot link: ref relative to the lockfile dir, so a
    // working source setup records the target workspace-root-relative.
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    resolution: {directory: vendor/dir, type: directory}',
      '',
      'snapshots:',
      '',
      '  vendored-dir@file:vendor/dir:',
      '    dependencies:',
      '      helper: link:vendor/helper',
      '',
    ].join('\n');

    const paths = getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)
      .map((a) => a.path)
      .sort();
    expect(paths).toEqual(['vendor/dir/index.js', 'vendor/helper/index.js']);
  });

  it('warns about a symbolic link inside a shipped directory instead of silently dropping it', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/linked/index.js'), 'module.exports={}');
    symlinkSync(
      join(tempDir, 'vendor/linked/index.js'),
      join(tempDir, 'vendor/linked/alias.js')
    );

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      '        specifier: link:vendor/linked',
      '        version: link:vendor/linked',
      '',
    ].join('\n');

    expect(
      getPrunedPnpmLocalPathArtifacts(tempDir, lockfile).map((a) => a.path)
    ).toEqual(['vendor/linked/index.js']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('symbolic link'));
  });

  const linkImporterLockfile = (target: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      `        specifier: link:${target}`,
      `        version: link:${target}`,
      '',
    ].join('\n');

  it('warns and skips a symlinked local-path root resolving outside the workspace', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    // The lexical escape check sees vendor/linked, but the symlink resolves
    // outside the workspace; following it would ship the outside tree.
    const outsideDir = mkdtempSync(join(tmpdir(), 'nx-pruned-outside-'));
    try {
      writeFileSync(join(outsideDir, 'secret.txt'), 'secret');
      mkdirSync(join(tempDir, 'vendor'));
      symlinkSync(outsideDir, join(tempDir, 'vendor/linked'));

      expect(
        getPrunedPnpmLocalPathArtifacts(
          tempDir,
          linkImporterLockfile('vendor/linked')
        )
      ).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('outside the workspace root')
      );
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('ships a symlinked local-path root resolving inside the workspace', () => {
    // The pruned manifest and lockfile already point at the relocated path, so
    // skipping the copy installs clean and fails at runtime with MODULE_NOT_FOUND.
    mkdirSync(join(tempDir, 'libs/real'), { recursive: true });
    writeFileSync(join(tempDir, 'libs/real/index.js'), 'REAL');
    mkdirSync(join(tempDir, 'vendor'));
    symlinkSync(join(tempDir, 'libs/real'), join(tempDir, 'vendor/linked'));

    const artifacts = getPrunedPnpmLocalPathArtifacts(
      tempDir,
      linkImporterLockfile('vendor/linked')
    );

    expect(artifacts).toEqual([
      {
        path: 'vendor/linked/index.js',
        sourcePath: join(tempDir, 'vendor/linked/index.js'),
      },
    ]);
    expect(readFileSync(artifacts[0].sourcePath, 'utf-8')).toBe('REAL');
  });

  it('warns and skips a local-path root that resolves to the workspace root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mkdirSync(join(tempDir, 'libs'), { recursive: true });
    writeFileSync(join(tempDir, 'libs/unrelated.js'), 'UNRELATED');
    mkdirSync(join(tempDir, 'vendor'));
    symlinkSync(tempDir, join(tempDir, 'vendor/linked'));

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        linkImporterLockfile('vendor/linked')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('resolves to the workspace root itself')
    );
  });

  it('warns and skips a dangling symlinked local-path root', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    mkdirSync(join(tempDir, 'vendor'));
    symlinkSync(join(tempDir, 'libs/gone'), join(tempDir, 'vendor/linked'));

    expect(
      getPrunedPnpmLocalPathArtifacts(
        tempDir,
        linkImporterLockfile('vendor/linked')
      )
    ).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('was not found'));
  });

  it('warns and skips a symlinked file: tarball', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const outsideDir = mkdtempSync(join(tmpdir(), 'nx-pruned-outside-'));
    try {
      writeFileSync(join(outsideDir, 'real.tgz'), Buffer.from([0, 1, 2, 3]));
      mkdirSync(join(tempDir, 'vendor'));
      symlinkSync(
        join(outsideDir, 'real.tgz'),
        join(tempDir, 'vendor/vendored-lib-1.0.0.tgz')
      );

      expect(
        getPrunedPnpmLocalPathArtifacts(
          tempDir,
          lockfileWithTarball('file:vendor/vendored-lib-1.0.0.tgz')
        )
      ).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('outside the workspace root')
      );
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('ships a symlinked file: tarball resolving inside the workspace', () => {
    mkdirSync(join(tempDir, 'dist'), { recursive: true });
    const bytes = Buffer.from([9, 8, 7]);
    writeFileSync(join(tempDir, 'dist/real.tgz'), bytes);
    mkdirSync(join(tempDir, 'vendor'));
    symlinkSync(
      join(tempDir, 'dist/real.tgz'),
      join(tempDir, 'vendor/vendored-lib-1.0.0.tgz')
    );

    const artifacts = getPrunedPnpmLocalPathArtifacts(
      tempDir,
      lockfileWithTarball('file:vendor/vendored-lib-1.0.0.tgz')
    );

    expect(artifacts).toHaveLength(1);
    expect(artifacts[0].path).toBe('vendor/vendored-lib-1.0.0.tgz');
    expect(readFileSync(artifacts[0].sourcePath).equals(bytes)).toBe(true);
  });

  it('ships a contained directory at its shipped path, reading from the source', () => {
    // The pruned lockfile records the target relocated under local_path_modules;
    // it ships there while the bytes come from the original workspace location.
    mkdirSync(join(tempDir, 'vendor/dir'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/dir/index.js'), 'module.exports={}');

    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  dir-dep@file:local_path_modules/vendor/dir:',
      '    resolution: {directory: local_path_modules/vendor/dir, type: directory}',
      '',
    ].join('\n');

    expect(getPrunedPnpmLocalPathArtifacts(tempDir, lockfile)).toEqual([
      {
        path: 'local_path_modules/vendor/dir/index.js',
        sourcePath: join(tempDir, 'vendor/dir/index.js'),
      },
    ]);
  });

  it('returns [] when there is no pruned lockfile content', () => {
    expect(getPrunedPnpmLocalPathArtifacts(tempDir)).toEqual([]);
  });
});

describe('containShippedLocalFilePaths', () => {
  it('relocates vendored file: keys, resolutions, and refs; leaves others', () => {
    const lockfile = {
      importers: {
        '.': {
          specifiers: { vendored: 'file:../vendor/dir', lodash: '^4.17.21' },
          dependencies: {
            vendored: 'file:vendor/dir',
            lodash: '4.17.21',
            wsmod: 'file:workspace_modules/wsmod',
          },
        },
      },
      packages: {
        'vendored@file:vendor/dir': {
          resolution: { directory: 'vendor/dir', type: 'directory' },
        },
        'tarball@file:vendor/pkg.tgz': {
          resolution: { tarball: 'file:vendor/pkg.tgz' },
        },
        'lodash@4.17.21': { resolution: { integrity: 'sha512-x' } },
        'wsmod@file:workspace_modules/wsmod': {
          resolution: {
            directory: 'workspace_modules/wsmod',
            type: 'directory',
          },
        },
      },
    };

    containShippedLocalFilePaths(lockfile);

    // Vendored file: keys/resolutions relocate; workspace-module and npm entries
    // are left untouched.
    expect(Object.keys(lockfile.packages).sort()).toEqual([
      'lodash@4.17.21',
      'tarball@file:local_path_modules/vendor/pkg.tgz',
      'vendored@file:local_path_modules/vendor/dir',
      'wsmod@file:workspace_modules/wsmod',
    ]);
    expect(
      (lockfile.packages as any)['vendored@file:local_path_modules/vendor/dir']
        .resolution.directory
    ).toBe('local_path_modules/vendor/dir');
    expect(
      (lockfile.packages as any)[
        'tarball@file:local_path_modules/vendor/pkg.tgz'
      ].resolution.tarball
    ).toBe('file:local_path_modules/vendor/pkg.tgz');
    // Importer refs: vendored file: contained; workspace-module and npm untouched;
    // the specifier is left for the manifest to own.
    expect(lockfile.importers['.'].dependencies).toEqual({
      vendored: 'file:local_path_modules/vendor/dir',
      lodash: '4.17.21',
      wsmod: 'file:workspace_modules/wsmod',
    });
    expect(lockfile.importers['.'].specifiers.vendored).toBe(
      'file:../vendor/dir'
    );
  });

  it('leaves an escaping path untouched', () => {
    const lockfile = {
      packages: {
        'b@file:../outside': {
          resolution: { directory: '../outside', type: 'directory' },
        },
      },
    };

    containShippedLocalFilePaths(lockfile);

    expect(Object.keys(lockfile.packages)).toEqual(['b@file:../outside']);
  });

  it('contains a workspace path that starts with the shipped directory name', () => {
    // A workspace directory literally named local_path_modules/ is a source
    // path like any other; treating it as already contained would make the
    // output ship bytes read from the wrong tree.
    const lockfile = {
      packages: {
        'a@file:local_path_modules/vendor/a': {
          resolution: {
            directory: 'local_path_modules/vendor/a',
            type: 'directory',
          },
        },
      },
    };

    containShippedLocalFilePaths(lockfile);

    expect(Object.keys(lockfile.packages)).toEqual([
      'a@file:local_path_modules/local_path_modules/vendor/a',
    ]);
    expect(
      (lockfile.packages as any)[
        'a@file:local_path_modules/local_path_modules/vendor/a'
      ].resolution.directory
    ).toBe('local_path_modules/local_path_modules/vendor/a');
  });

  it('normalizes backslash separators in a directory resolution before containing', () => {
    const lockfile = {
      packages: {
        'a@file:vendor/a': {
          resolution: { directory: 'vendor\\a', type: 'directory' },
        },
      },
    };

    containShippedLocalFilePaths(lockfile);

    expect(
      (lockfile.packages as any)['a@file:local_path_modules/vendor/a']
        .resolution.directory
    ).toBe('local_path_modules/vendor/a');
  });
});

describe('containLocalPath', () => {
  it.each([
    'vendor/a',
    // a workspace directory sharing the shipped directory's name is not an
    // already-contained path, so it relocates like any other
    'local_path_modules/vendor/a',
  ])('round-trips %s through uncontainLocalPath', (wsRelativePath) => {
    const contained = containLocalPath(wsRelativePath);

    expect(contained).toBe(`local_path_modules/${wsRelativePath}`);
    expect(uncontainLocalPath(contained)).toBe(wsRelativePath);
  });
});

describe('relocatePrunedLocalPathSpec', () => {
  it.each([
    ['file:../../vendor/lib', 'file:local_path_modules/vendor/lib'],
    // a Windows-authored spec must resolve to the same target as its posix form
    ['file:..\\..\\vendor\\lib', 'file:local_path_modules/vendor/lib'],
    ['link:..\\..\\vendor\\lib', 'link:local_path_modules/vendor/lib'],
    ['file:.\\sub', 'file:local_path_modules/apps/app/sub'],
  ])('relocates %s to %s', (spec, expected) => {
    expect(relocatePrunedLocalPathSpec(spec, 'apps/app', '')).toEqual({
      spec: expected,
    });
  });

  it('still reports a backslash-authored spec that leaves the workspace', () => {
    expect(
      relocatePrunedLocalPathSpec('file:..\\..\\..\\outside', 'apps/app', '')
    ).toEqual({
      spec: 'file:..\\..\\..\\outside',
      reason: 'outside-workspace',
    });
  });

  // A trailing separator survives the join, so these reach the workspace-root
  // check as './' rather than '.'.
  it.each([
    ['file:../../', 'apps/app'],
    ['link:../../', 'apps/app'],
    ['file:./', ''],
  ])('reports %s from %s as the workspace root', (spec, sourceDir) => {
    expect(relocatePrunedLocalPathSpec(spec, sourceDir, '')).toEqual({
      spec,
      reason: 'workspace-root',
    });
  });

  it('drops a trailing separator from a shippable target', () => {
    expect(
      relocatePrunedLocalPathSpec('file:../../vendor/lib/', 'apps/app', '')
    ).toEqual({ spec: 'file:local_path_modules/vendor/lib' });
  });
});

describe('rewritePrunedLocalPathSpecifiers', () => {
  const WS = '/ws';

  beforeEach(() => {
    // Isolate from any real catalog config; the catalog test overrides this.
    jest.spyOn(catalog, 'getCatalogManager').mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rewrites a file: directory specifier to its shipped location', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { vendored: 'file:./vendor/pkg' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.vendored).toBe(
      'file:local_path_modules/apps/api/vendor/pkg'
    );
  });

  it('rewrites a link: specifier to its shipped location', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { shared: 'link:../shared' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.shared).toBe(
      'link:local_path_modules/apps/shared'
    );
  });

  it('resolves the path from a nested project root', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { lib: 'link:../../lib' },
    };

    rewritePrunedLocalPathSpecifiers(
      packageJson,
      'apps/nested/api',
      WS,
      new Set()
    );

    expect(packageJson.dependencies.lib).toBe(
      'link:local_path_modules/apps/lib'
    );
  });

  it('moves a file:/link: peer dependency into dependencies and drops its meta', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      peerDependencies: { shared: 'link:../shared' },
      peerDependenciesMeta: { shared: { optional: true } },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies).toEqual({
      shared: 'link:local_path_modules/apps/shared',
    });
    // The sections held nothing but the moved peer, so they are dropped rather
    // than shipped empty.
    expect(packageJson.peerDependencies).toBeUndefined();
    expect(packageJson.peerDependenciesMeta).toBeUndefined();
  });

  it('keeps the peer sections when a peer that is not a local path remains', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      peerDependencies: { shared: 'link:../shared', react: '^18.0.0' },
      peerDependenciesMeta: {
        shared: { optional: true },
        react: { optional: false },
      },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.peerDependencies).toEqual({ react: '^18.0.0' });
    expect(packageJson.peerDependenciesMeta).toEqual({
      react: { optional: false },
    });
  });

  it('leaves a target that escapes the workspace root as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { external: 'file:../../../outside/pkg' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.external).toBe('file:../../../outside/pkg');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('leaves an absolute local-path specifier as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { vendored: 'link:/opt/thing' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.vendored).toBe('link:/opt/thing');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('leaves a link: to the workspace root itself as-is with a warning', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { 'root-pkg': 'link:../..' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies['root-pkg']).toBe('link:../..');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('workspace root itself')
    );
  });

  it('still moves an unshippable local-path peer into dependencies', () => {
    // pnpm rejects any file:/link: spec under peerDependencies, so even a
    // warned-about target must move or the whole install fails.
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      peerDependencies: { external: 'link:../../../outside/shared' },
      peerDependenciesMeta: { external: { optional: true } },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies).toEqual({
      external: 'link:../../../outside/shared',
    });
    expect(packageJson.peerDependencies).toBeUndefined();
    expect(packageJson.peerDependenciesMeta).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('outside the workspace root')
    );
  });

  it('skips a workspace package declared via link:', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { '@scope/lib': 'link:../../libs/lib' },
    };

    rewritePrunedLocalPathSpecifiers(
      packageJson,
      'apps/api',
      WS,
      new Set(['@scope/lib'])
    );

    expect(packageJson.dependencies['@scope/lib']).toBe('link:../../libs/lib');
  });

  it('leaves a registry specifier untouched', () => {
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.lodash).toBe('^4.17.21');
  });

  it('resolves a catalog: reference before rewriting the local path', () => {
    jest.spyOn(catalog, 'getCatalogManager').mockReturnValue({
      isCatalogReference: (spec: string) => spec === 'catalog:',
      resolveCatalogReference: () => 'link:../shared',
    } as any);
    const packageJson: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { shared: 'catalog:' },
    };

    rewritePrunedLocalPathSpecifiers(packageJson, 'apps/api', WS, new Set());

    expect(packageJson.dependencies.shared).toBe(
      'link:local_path_modules/apps/shared'
    );
  });
});

describe('validatePrunedLocalPathClosure', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-link-closure-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  // A pruned lockfile whose root importer links a vendored package.
  const lockfileLinking = (linkPath: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      linked-lib:',
      `        specifier: link:${linkPath}`,
      `        version: link:${linkPath}`,
      '',
    ].join('\n');

  function writeLinkedManifest(manifest: Record<string, unknown>) {
    mkdirSync(join(tempDir, 'vendor/linked'), { recursive: true });
    writeFileSync(
      join(tempDir, 'vendor/linked/package.json'),
      JSON.stringify({ name: 'linked-lib', version: '1.0.0', ...manifest })
    );
  }

  it('does not validate a link target that resolves to the workspace root', () => {
    // The declared path is inside the workspace, so only resolving it shows
    // that the target is the workspace root itself. Validating it would fail
    // the build over the root manifest's own dependencies.
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        dependencies: { 'only-at-root': '1.0.0' },
      })
    );
    mkdirSync(join(tempDir, 'tools'), { recursive: true });
    symlinkSync(tempDir, join(tempDir, 'tools/ws-link'));

    expect(() =>
      validatePrunedLocalPathClosure(
        { name: 'app', version: '1.0.0' },
        tempDir,
        lockfileLinking('tools/ws-link')
      )
    ).not.toThrow();
  });

  it('does not validate a link target that resolves outside the workspace', () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'nx-link-outside-'));
    try {
      writeFileSync(
        join(outsideDir, 'package.json'),
        JSON.stringify({
          name: 'outside-lib',
          version: '1.0.0',
          dependencies: { lodash: '^4.0.0' },
        })
      );
      mkdirSync(join(tempDir, 'vendor'), { recursive: true });
      symlinkSync(outsideDir, join(tempDir, 'vendor/linked'));

      expect(() =>
        validatePrunedLocalPathClosure(
          { name: 'app', version: '1.0.0' },
          tempDir,
          lockfileLinking('vendor/linked')
        )
      ).not.toThrow();
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it('does not validate a local-path package that resolves to the workspace root', () => {
    // A trailing-separator spec relocated to `local_path_modules/./`, which
    // reads back as the workspace root and failed the build over the root
    // manifest's own dependencies.
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        dependencies: { 'only-at-root': '1.0.0' },
      })
    );
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  root@file:local_path_modules/./:',
      '    resolution: {directory: local_path_modules/./, type: directory}',
      '',
    ].join('\n');

    expect(() =>
      validatePrunedLocalPathClosure(
        { name: 'app', version: '1.0.0' },
        tempDir,
        lockfile
      )
    ).not.toThrow();
  });

  it('reads the manifest of a link target under a local_path_modules workspace directory', () => {
    // The lockfile records the target relocated, so a workspace directory
    // already named local_path_modules/ is doubly prefixed there. Resolving
    // that back must reach the real manifest and not a same-named root
    // directory, or the validator silently checks the wrong closure.
    mkdirSync(join(tempDir, 'local_path_modules/linked'), { recursive: true });
    writeFileSync(
      join(tempDir, 'local_path_modules/linked/package.json'),
      JSON.stringify({
        name: 'linked-lib',
        version: '1.0.0',
        dependencies: { lodash: '^4.0.0' },
      })
    );
    // the decoy the old prefix test would have read instead
    mkdirSync(join(tempDir, 'linked'), { recursive: true });
    writeFileSync(
      join(tempDir, 'linked/package.json'),
      JSON.stringify({ name: 'linked-lib', version: '1.0.0' })
    );
    const app: PackageJson = { name: 'app', version: '0.0.1' };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking(containLocalPath('local_path_modules/linked'))
      )
    ).toThrow(/lodash/);
  });

  it('passes when the linked package required deps are app direct dependencies', () => {
    writeLinkedManifest({ dependencies: { lodash: '^4.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).not.toThrow();
  });

  it('passes when the required dep is an app optionalDependency', () => {
    writeLinkedManifest({ dependencies: { fsevents: '^2.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      optionalDependencies: { fsevents: '^2.3.0' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).not.toThrow();
  });

  it('passes when the required dep is an app peerDependency', () => {
    // The pruned lockfile's root importer folds app peers into dependencies,
    // so the deploy install provides them.
    writeLinkedManifest({ dependencies: { react: '^18.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      peerDependencies: { react: '^18.0.0' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).not.toThrow();
  });

  it('fails when a linked package requires a dep absent from the app direct deps', () => {
    writeLinkedManifest({ dependencies: { 'missing-dep': '^1.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).toThrow(
      /linked package linked-lib requires missing-dep.*Convert linked-lib to a file: dependency.*add missing-dep to app/s
    );
  });

  it('warns (not fails) when the required dep is only an app devDependency', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeLinkedManifest({ dependencies: { typescript: '^5.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      devDependencies: { typescript: '^5.4.0' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('only a devDependency')
    );
  });

  it('warns (not fails) on a link target peer dependency not visible to the app', () => {
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    writeLinkedManifest({ peerDependencies: { react: '^18.0.0' } });
    const app: PackageJson = { name: 'app', version: '0.0.1' };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileLinking('vendor/linked')
      )
    ).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('may need react')
    );
  });

  it('does nothing when the pruned lockfile has no link: targets', () => {
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };
    const lockfile = [
      "lockfileVersion: '9.0'",
      '',
      'packages:',
      '',
      '  lodash@4.17.21:',
      '    resolution: {integrity: sha512-abc}',
      '',
    ].join('\n');

    expect(() =>
      validatePrunedLocalPathClosure(app, tempDir, lockfile)
    ).not.toThrow();
  });

  // A directory package entry with no dependency edges (a backfilled
  // autoInstallPeers peer synthesized by the pnpm parser).
  const lockfileWithDirEntry = (snapshotBody: string) =>
    [
      "lockfileVersion: '9.0'",
      '',
      'importers:',
      '',
      '  .:',
      '    dependencies:',
      '      mylib:',
      '        specifier: file:workspace_modules/mylib',
      '        version: file:workspace_modules/mylib',
      '',
      'packages:',
      '',
      '  dir-peer@file:vendor/dir-peer:',
      '    resolution: {directory: vendor/dir-peer, type: directory}',
      '',
      'snapshots:',
      '',
      `  dir-peer@file:vendor/dir-peer: ${snapshotBody}`,
      '',
    ].join('\n');

  function writeDirPeerManifest(manifest: Record<string, unknown>) {
    mkdirSync(join(tempDir, 'vendor/dir-peer'), { recursive: true });
    writeFileSync(
      join(tempDir, 'vendor/dir-peer/package.json'),
      JSON.stringify({ name: 'dir-peer', version: '1.0.0', ...manifest })
    );
  }

  it('fails when an edge-less directory package requires a dep absent from the app deps', () => {
    writeDirPeerManifest({ dependencies: { 'missing-dep': '^1.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(app, tempDir, lockfileWithDirEntry('{}'))
    ).toThrow(
      /local package dir-peer requires missing-dep.*Declare dir-peer as a regular dependency.*enable autoInstallPeers/s
    );
  });

  it('passes when the edge-less directory package required deps are app dependencies', () => {
    writeDirPeerManifest({ dependencies: { lodash: '^4.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
      dependencies: { lodash: '^4.17.21' },
    };

    expect(() =>
      validatePrunedLocalPathClosure(app, tempDir, lockfileWithDirEntry('{}'))
    ).not.toThrow();
  });

  it('skips a directory package whose lockfile entry carries resolved edges', () => {
    // pnpm installs the recorded closure, so the manifest needs no validation.
    writeDirPeerManifest({ dependencies: { 'missing-dep': '^1.0.0' } });
    const app: PackageJson = {
      name: 'app',
      version: '0.0.1',
    };

    expect(() =>
      validatePrunedLocalPathClosure(
        app,
        tempDir,
        lockfileWithDirEntry('\n    dependencies:\n      missing-dep: 1.0.0')
      )
    ).not.toThrow();
  });
});

describe('warnIncompletePrunedPnpmOutput', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-incomplete-'));
    jest
      .spyOn(pacakgeManager, 'getPackageManagerVersion')
      .mockReturnValue('11.2.2');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  const lockfileWith = (body = '') =>
    ["lockfileVersion: '9.0'", '', 'packages:', '', ...body.split('\n')].join(
      '\n'
    );

  it('stays silent when the workspace declares nothing the lockfile alone misses', () => {
    const warn = jest.spyOn(output, 'warn').mockImplementation(() => {});

    warnIncompletePrunedPnpmOutput(lockfileWith(), tempDir);

    expect(warn).not.toHaveBeenCalled();
  });

  it('names the build-script approvals a bare lockfile would drop', () => {
    writeFileSync(
      join(tempDir, 'pnpm-workspace.yaml'),
      'allowBuilds:\n  esbuild: true\n'
    );
    const warn = jest.spyOn(output, 'warn').mockImplementation(() => {});

    warnIncompletePrunedPnpmOutput(
      lockfileWith(
        '  esbuild@0.25.0:\n    resolution: {integrity: sha512-abc}'
      ),
      tempDir
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: [
          expect.stringContaining('build-script approvals'),
          expect.stringContaining('createPrunedLockfile'),
        ],
      })
    );
  });

  it('does not name build-script approvals for a workspace that only patches', () => {
    writeFileSync(
      join(tempDir, 'pnpm-workspace.yaml'),
      'patchedDependencies:\n  is-number@7.0.0: patches/is-number@7.0.0.patch\n'
    );
    const warn = jest.spyOn(output, 'warn').mockImplementation(() => {});

    warnIncompletePrunedPnpmOutput(
      [
        lockfileWith(
          '  is-number@7.0.0:\n    resolution: {integrity: sha512-abc}'
        ),
        'patchedDependencies:',
        '  is-number@7.0.0: hash-is-number',
        '',
      ].join('\n'),
      tempDir
    );

    const { bodyLines } = warn.mock.calls[0][0] as { bodyLines: string[] };
    expect(bodyLines[0]).toContain('patch files');
    expect(bodyLines[0]).not.toContain('build-script approvals');
  });

  it('names the vendored local paths a bare lockfile would drop', () => {
    mkdirSync(join(tempDir, 'vendor/lib'), { recursive: true });
    writeFileSync(join(tempDir, 'vendor/lib/index.js'), 'REAL');
    const warn = jest.spyOn(output, 'warn').mockImplementation(() => {});

    warnIncompletePrunedPnpmOutput(
      lockfileWith(
        '  lib@file:vendor/lib:\n    resolution: {directory: vendor/lib, type: directory}'
      ),
      tempDir
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        bodyLines: [
          expect.stringContaining('vendored file:/link: dependencies'),
          expect.anything(),
        ],
      })
    );
  });
});
