import type { Mock } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ProjectGraph } from '../../../config/project-graph';
import { parseJson } from '../../../utils/json';
import { output } from '../../../utils/output';
import type { PackageJson } from '../../../utils/package-json';
import {
  bundledDependenciesPrunedBunLock,
  bundledDependenciesRootBunLock,
} from './__fixtures__/bun/pruned-bundled-dependencies.bun.lock';
import {
  libraryDependenciesPrunedBunLock,
  libraryDependenciesRootBunLock,
  libraryOptionalPeerPrunedBunLock,
} from './__fixtures__/bun/pruned-library-dependencies.bun.lock';
import {
  namesakeOverridePrunedBunLock,
  namesakeOverrideRootBunLock,
  overriddenDependencyPrunedBunLock,
  overriddenDependencyRootBunLock,
} from './__fixtures__/bun/pruned-overridden-dependency.bun.lock';
import { patchedDependenciesRootBunLock } from './__fixtures__/bun/pruned-patched-dependencies.bun.lock';
import {
  siblingOptionalPeerInRangePrunedBunLock,
  siblingOptionalPeerInRangeRootBunLock,
  siblingOptionalPeerOutOfRangePrunedBunLock,
  siblingOptionalPeerOutOfRangeRootBunLock,
} from './__fixtures__/bun/pruned-sibling-optional-peers.bun.lock';
import {
  emptyTrustedDependenciesRootBunLock,
  omittedTrustedDependenciesRootBunLock,
  trustedDependenciesRootBunLock,
} from './__fixtures__/bun/pruned-trusted-dependencies.bun.lock';
import {
  unresolvedModulePrunedBunLock,
  unresolvedModuleRootBunLock,
  unresolvedOptionalPrunedBunLock,
  unresolvedOptionalRootBunLock,
  unresolvedVendoredDroppedPrunedBunLock,
  unresolvedVendoredDroppedRootBunLock,
  unresolvedVendoredKeptPrunedBunLock,
  unresolvedVendoredKeptRootBunLock,
} from './__fixtures__/bun/pruned-unresolved-optional-dependencies.bun.lock';
import {
  vendoredPackagesPrunedBunLock,
  vendoredPackagesRootBunLock,
  vendoredWorkspaceNamePrunedBunLock,
  vendoredWorkspaceNameRootBunLock,
} from './__fixtures__/bun/pruned-vendored-packages.bun.lock';
import {
  workspaceModulesPrunedBunLock,
  workspaceModulesRootBunLock,
} from './__fixtures__/bun/pruned-workspace-modules.bun.lock';
import { generatePrunedDeployOutput } from './lock-file';
import { stringifyPnpmLockfile } from './pnpm-parser';
import {
  getPrunedPnpmInstallArtifacts,
  rewritePrunedLocalPathSpecifiers,
} from './pruned-output';

vi.mock('./pnpm-parser', async () => ({
  ...(await vi.importActual('./pnpm-parser')),
  stringifyPnpmLockfile: vi.fn(() => 'PRUNED_LOCKFILE'),
}));
vi.mock('./project-graph-pruning', async () => ({
  ...(await vi.importActual('./project-graph-pruning')),
  pruneProjectGraph: vi.fn((graph) => graph),
}));
vi.mock('./pruned-output', async () => ({
  ...(await vi.importActual('./pruned-output')),
  getPrunedPnpmInstallArtifacts: vi.fn(),
  rewritePrunedLocalPathSpecifiers: vi.fn(),
  validatePrunedLocalPathClosure: vi.fn(),
}));

// The two sinks are the reason this entry point exists: the file-writing
// executors and the bundler asset pipelines must ship the same output.
const FIXTURE_ROOT_LOCKFILE = 'FIXTURE_ROOT_LOCKFILE';

describe('generatePrunedDeployOutput sinks', () => {
  const graph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };
  let tempDir: string;
  let vendoredFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-deploy-'));
    // The entry point resolves the root lockfile from its `workspaceRoot`
    // option, so the fixture root needs one. The marker is what proves the read
    // came from here rather than from this checkout's own lockfile.
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), FIXTURE_ROOT_LOCKFILE);
    vendoredFile = join(tempDir, 'vendor/lib/index.js');
    mkdirSync(join(tempDir, 'vendor/lib'), { recursive: true });
    writeFileSync(vendoredFile, 'VENDORED\n');
    (getPrunedPnpmInstallArtifacts as Mock).mockReturnValue([
      { path: 'pnpm-workspace.yaml', content: 'packages: []\n' },
      { path: 'patches/patches/is-number.patch', content: 'THE PATCH\n' },
      {
        path: 'local_path_modules/vendor/lib/index.js',
        sourcePath: vendoredFile,
      },
    ]);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  function run(outputDirectory: string) {
    generatePrunedDeployOutput(
      { name: 'app', version: '1.0.0' } as PackageJson,
      graph,
      'apps/app',
      { outputDirectory, packageManager: 'pnpm', workspaceRoot: tempDir }
    );
  }

  function emit() {
    const emitted = new Map<string, string>();
    generatePrunedDeployOutput(
      { name: 'app', version: '1.0.0' } as PackageJson,
      graph,
      'apps/app',
      {
        emit: (path, content) => emitted.set(path, content.toString()),
        packageManager: 'pnpm',
        workspaceRoot: tempDir,
      }
    );
    return emitted;
  }

  it('prunes the root lockfile of the workspace root it was given', () => {
    run(join(tempDir, 'dist'));

    expect(stringifyPnpmLockfile).toHaveBeenCalledWith(
      expect.anything(),
      FIXTURE_ROOT_LOCKFILE,
      expect.anything(),
      tempDir,
      'apps/app'
    );
  });

  it('writes the same output the emit sink ships', () => {
    const outputDirectory = join(tempDir, 'dist');

    run(outputDirectory);
    const emitted = emit();

    const written = new Map(
      [...emitted.keys()].map((path) => [
        path,
        readFileSync(join(outputDirectory, path), 'utf-8'),
      ])
    );
    expect(written).toEqual(emitted);
    expect([...emitted.keys()]).toEqual([
      'pnpm-lock.yaml',
      'pnpm-workspace.yaml',
      'patches/patches/is-number.patch',
      'local_path_modules/vendor/lib/index.js',
    ]);
    expect(emitted.get('pnpm-lock.yaml')).toBe('PRUNED_LOCKFILE');
    expect(emitted.get('local_path_modules/vendor/lib/index.js')).toBe(
      'VENDORED\n'
    );
  });

  it('creates the output directory and every artifact directory under it', () => {
    const outputDirectory = join(tempDir, 'dist/apps/app');

    run(outputDirectory);

    expect(existsSync(join(outputDirectory, 'pnpm-lock.yaml'))).toBe(true);
    expect(
      existsSync(join(outputDirectory, 'patches/patches/is-number.patch'))
    ).toBe(true);
  });

  // The emit sink can only add assets, and a cache replay restores only the
  // files the replayed entry holds, so neither sink can retract a file a prior
  // deploy shipped. Both must overwrite it instead.
  it('overwrites a settings file a prior deploy left in the output', () => {
    const outputDirectory = join(tempDir, 'dist');
    mkdirSync(outputDirectory);
    const stale = join(outputDirectory, 'pnpm-workspace.yaml');
    writeFileSync(stale, 'allowBuilds:\n  esbuild: true\n');

    run(outputDirectory);

    expect(readFileSync(stale, 'utf-8')).toBe('packages: []\n');
    expect(emit().get('pnpm-workspace.yaml')).toBe('packages: []\n');
  });

  it('ships nothing for a binary bun.lockb and leaves the manifest as authored', () => {
    writeFileSync(join(tempDir, 'bun.lockb'), Buffer.from([0x23, 0x21, 0x00]));
    const warn = vi.spyOn(output, 'warn').mockImplementation(() => {});
    const outputDirectory = join(tempDir, 'dist');
    const packageJson = { name: 'app', version: '1.0.0' } as PackageJson;
    const emitted: string[] = [];

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      outputDirectory,
      packageManager: 'bun',
      workspaceRoot: tempDir,
    });
    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit: (path) => emitted.push(path),
      packageManager: 'bun',
      workspaceRoot: tempDir,
    });

    expect(existsSync(outputDirectory)).toBe(false);
    expect(emitted).toEqual([]);
    expect(packageJson).toEqual({ name: 'app', version: '1.0.0' });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

// Bun accepts each expected lockfile with `bun install --frozen-lockfile` in the
// pruned output directory and leaves it unchanged on a plain `bun install`.
// The workspace modules copies have their devDependencies removed, as
// copy-workspace-modules ships them for Bun.
describe('generatePrunedDeployOutput for bun', () => {
  const project = (name: string, root: string) => ({
    name,
    type: 'lib' as const,
    data: { root, metadata: { js: { packageName: `@demo/${name}` } } },
  });
  const graph: ProjectGraph = {
    nodes: {
      api: project('api', 'apps/api'),
      util: project('util', 'libs/util'),
      util2: project('util2', 'libs/util2'),
    },
    dependencies: {},
    externalNodes: {},
  };
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'nx-pruned-bun-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function prune(
    rootLockFile: string,
    packageJson: PackageJson,
    projectGraph = graph
  ) {
    writeFileSync(join(tempDir, 'bun.lock'), rootLockFile);
    const outputDirectory = join(tempDir, 'dist');
    generatePrunedDeployOutput(packageJson, projectGraph, 'apps/api', {
      outputDirectory,
      packageManager: 'bun',
      workspaceRoot: tempDir,
    });
    const lockFilePath = join(outputDirectory, 'bun.lock');
    return existsSync(lockFilePath)
      ? readFileSync(lockFilePath, 'utf-8')
      : undefined;
  }

  it.each([
    {
      // Nested and workspace-scoped root entries, a folder dependency of a
      // folder dependency, and an optional peer the root installs elsewhere,
      // which debug links in the workspace too.
      scenario: 'workspace modules from a lockfileVersion 2 bun.lock',
      rootLockFile: workspaceModulesRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: {
          '@demo/util': 'workspace:*',
          debug: '^4.3.0',
          'is-odd': '^1.0.0',
          lp: 'npm:left-pad@^1.3.0',
          'normalize-path': '^3.0.0',
        },
        optionalDependencies: { fsevents: '^2.3.0' },
      },
      expected: workspaceModulesPrunedBunLock,
    },
    {
      // `ms` comes from a library and only resolves to a matching version
      // under that library's workspace scope. The locked is-buffer keeps the
      // override's version without the override.
      scenario:
        'library dependencies and overrides from a lockfileVersion 1 bun.lock',
      rootLockFile: libraryDependenciesRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: {
          debug: '^4.3.0',
          'is-odd': '^1.0.0',
          lp: 'npm:left-pad@^1.3.0',
          ms: '^2.1.0',
          'normalize-path': '^3.0.0',
          picomatch: '^2.0.0',
          'use-sync-external-store': '1.2.0',
        },
        optionalDependencies: { fsevents: '^2.3.0' },
        overrides: { 'is-buffer': '1.1.5' },
      },
      expected: libraryDependenciesPrunedBunLock,
    },
    {
      // Bun 1.3.13 rejects a frozen install whose lockfile omits `optionalPeers`.
      scenario: 'an optional peer from a lockfileVersion 1 bun.lock',
      rootLockFile: libraryDependenciesRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        peerDependencies: { 'is-odd': '^1.0.0' },
        peerDependenciesMeta: { 'is-odd': { optional: true } },
      },
      expected: libraryOptionalPeerPrunedBunLock,
    },
    {
      // fsevents bundles node-pre-gyp, whose tree Bun lists under fsevents as
      // the tarball lays it out, even where the app resolves the same version
      // (`ms`).
      scenario: 'a bundled dependency tree from a lockfileVersion 2 bun.lock',
      rootLockFile: bundledDependenciesRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: { fsevents: '1.2.4', ms: '^2.1.0' },
      },
      expected: bundledDependenciesPrunedBunLock,
    },
    {
      // `ws` has bufferutil as an optional peer, which only `@demo/util`
      // installs.
      scenario: 'an optional peer another project installs in range',
      rootLockFile: siblingOptionalPeerInRangeRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: { ws: '^8.18.0' },
      },
      expected: siblingOptionalPeerInRangePrunedBunLock,
    },
    {
      scenario: 'an optional peer another project installs out of range',
      rootLockFile: siblingOptionalPeerOutOfRangeRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: { ws: '^8.18.0' },
      },
      expected: siblingOptionalPeerOutOfRangePrunedBunLock,
    },
    {
      // A frozen install rejects any lockfile for a manifest Bun writes none for.
      scenario: 'a manifest without dependencies',
      rootLockFile: libraryDependenciesRootBunLock,
      packageJson: { name: '@demo/api', version: '0.0.1' },
      expected: undefined,
    },
    {
      // The root install resolved no `ms@99.0.0`, and debug's `ms` would
      // otherwise satisfy the edge.
      scenario: 'an optional dependency the root install left unresolved',
      rootLockFile: unresolvedOptionalRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '1.0.0',
        dependencies: { debug: '^4.3.0' },
        optionalDependencies: { ms: '99.0.0' },
      },
      expected: unresolvedOptionalPrunedBunLock,
    },
    {
      scenario:
        'a workspace module whose optional dependency stayed unresolved',
      rootLockFile: unresolvedModuleRootBunLock,
      packageJson: {
        name: '@demo/api',
        version: '1.0.0',
        dependencies: { '@demo/util': 'workspace:*', debug: '^4.3.0' },
      },
      expected: unresolvedModulePrunedBunLock,
    },
  ])(
    'ships the bun.lock Bun writes for $scenario',
    ({ rootLockFile, packageJson, expected }) => {
      expect(prune(rootLockFile, packageJson as PackageJson)).toBe(expected);
    }
  );

  // The root overrides ms to 2.1.2. Bun 1.4.4 re-resolves a dependency whose
  // locked version is outside its declared range unless the manifest
  // overrides it.
  it('declares the version an override installs outside the declared range', () => {
    const manifest: PackageJson = {
      name: '@demo/api',
      version: '1.0.0',
      dependencies: { 'is-odd': '^1.0.0', debug: '^4.3.0', ms: '2.0.0' },
      overrides: { 'is-buffer': '1.1.5' },
    };

    expect(prune(overriddenDependencyRootBunLock, manifest)).toBe(
      overriddenDependencyPrunedBunLock
    );
    expect(manifest.dependencies.ms).toBe('2.1.2');
    expect(manifest.overrides).toBeUndefined();
  });

  // apps/api is no workspace, and the workspace that shares its manifest name
  // gets ms 2.1.2 from a scoped override.
  it("keeps the declared range for a namesake workspace's override", () => {
    const manifest: PackageJson = {
      name: 'api',
      version: '0.0.1',
      dependencies: { ms: '2.0.0' },
    };

    expect(prune(namesakeOverrideRootBunLock, manifest)).toBe(
      namesakeOverridePrunedBunLock
    );
    expect(manifest.dependencies.ms).toBe('2.0.0');
  });

  it.each([
    {
      scenario: 'the installed names of the merged list',
      rootLockFile: trustedDependenciesRootBunLock,
      rootTrusted: ['supports-color', 'is-odd', 'fsevents'],
      projectTrusted: ['normalize-path'],
      expectedManifest: [
        'supports-color',
        'is-odd',
        'fsevents',
        'normalize-path',
      ],
      expectedLockFile: ['is-odd', 'normalize-path', 'fsevents'],
    },
    {
      scenario: 'an empty list a Bun 1.4.4 root lockfile records',
      rootLockFile: emptyTrustedDependenciesRootBunLock,
      rootTrusted: [],
      expectedManifest: [],
      expectedLockFile: [],
    },
    {
      scenario: 'an empty list an earlier root lockfile leaves out',
      rootLockFile: omittedTrustedDependenciesRootBunLock,
      rootTrusted: [],
      expectedManifest: [],
      expectedLockFile: undefined,
    },
  ])(
    'carries the root trustedDependencies for $scenario',
    ({
      rootLockFile,
      rootTrusted,
      projectTrusted,
      expectedManifest,
      expectedLockFile,
    }) => {
      writeFileSync(
        join(tempDir, 'package.json'),
        JSON.stringify({ name: 'demo', trustedDependencies: rootTrusted })
      );
      const packageJson: PackageJson = {
        name: '@demo/api',
        version: '0.0.1',
        dependencies: { 'is-odd': '^1.0.0', 'normalize-path': '^3.0.0' },
        optionalDependencies: { fsevents: '^2.3.0' },
        ...(projectTrusted && { trustedDependencies: projectTrusted }),
      };

      const written = prune(rootLockFile, packageJson);

      expect(packageJson.trustedDependencies).toEqual(expectedManifest);
      // Bun's order differs from the manifest's, and a frozen install ignores it.
      expect(
        parseJson(written, { allowTrailingComma: true })
          .trustedDependencies?.slice()
          .sort()
      ).toEqual(expectedLockFile?.slice().sort());
    }
  );

  describe('vendored local-path packages', () => {
    // `vend` nests a directory and a tarball, `@demo/util` declares a directory
    // and a tarball the prune-lockfile executor also declares at the root, and
    // `@demo/web` vendors another `vend`, so the root lockfile scopes the app's
    // copies under its workspace.
    const packageJson = (): PackageJson => ({
      name: '@demo/api',
      version: '1.0.0',
      dependencies: {
        '@demo/util': 'workspace:*',
        libvend: 'file:../../vendor/libvend',
        lnk: 'link:../../vendor/lnk',
        ltar: 'file:../../vendor/ltar-1.0.0.tgz',
        vend: 'file:../../vendor/vend',
        vtar: 'file:../../vendor/vtar-1.0.0.tgz',
      },
      peerDependencies: { pvend: 'file:../../vendor/pvend' },
    });

    beforeEach(async () => {
      const { rewritePrunedLocalPathSpecifiers: rewrite } =
        await vi.importActual<typeof import('./pruned-output')>(
          './pruned-output'
        );
      (rewritePrunedLocalPathSpecifiers as Mock).mockImplementationOnce(
        rewrite
      );
      for (const name of [
        'vend',
        'vend2',
        'inner',
        'lnk',
        'pvend',
        'libvend',
      ]) {
        mkdirSync(join(tempDir, 'vendor', name), { recursive: true });
        writeFileSync(
          join(tempDir, 'vendor', name, 'package.json'),
          JSON.stringify({ name, version: '1.0.0' })
        );
      }
      for (const name of ['vtar', 'ttar', 'ltar']) {
        writeFileSync(join(tempDir, 'vendor', `${name}-1.0.0.tgz`), name);
      }
    });

    it('ships them and the bun.lock Bun writes for them', () => {
      const manifest = packageJson();

      const written = prune(vendoredPackagesRootBunLock, manifest);

      expect(written).toBe(vendoredPackagesPrunedBunLock);
      expect(manifest.dependencies).toEqual({
        '@demo/util': 'workspace:*',
        libvend: 'file:local_path_modules/vendor/libvend',
        lnk: 'link:local_path_modules/vendor/lnk',
        ltar: 'file:local_path_modules/vendor/ltar-1.0.0.tgz',
        vend: 'file:local_path_modules/vendor/vend',
        vtar: 'file:local_path_modules/vendor/vtar-1.0.0.tgz',
      });
      // Bun accepts a `file:` peer, so it stays a peer.
      expect(manifest.peerDependencies).toEqual({
        pvend: 'file:local_path_modules/vendor/pvend',
      });
      expect(
        readdirSync(join(tempDir, 'dist/local_path_modules/vendor')).sort()
      ).toEqual([
        'inner',
        'libvend',
        'lnk',
        'ltar-1.0.0.tgz',
        'pvend',
        'ttar-1.0.0.tgz',
        'vend',
        'vtar-1.0.0.tgz',
      ]);
    });

    // `@demo/lib` vendors the same `util` as the app, and `@demo/web` uses the
    // workspace package `util`. `@demo/lib` is declared the way prune-lockfile
    // declares a workspace module the app reaches through another module.
    it('ships a vendored package named like a workspace package', () => {
      mkdirSync(join(tempDir, 'vendor/util'), { recursive: true });
      writeFileSync(
        join(tempDir, 'vendor/util/package.json'),
        JSON.stringify({ name: 'util', version: '9.0.0' })
      );
      const manifest: PackageJson = {
        name: '@demo/api',
        version: '1.0.0',
        dependencies: {
          '@demo/lib': 'file:./workspace_modules/@demo/lib',
          util: 'file:../../vendor/util',
        },
      };

      const written = prune(vendoredWorkspaceNameRootBunLock, manifest, {
        nodes: {
          api: project('api', 'apps/api'),
          lib: project('lib', 'libs/lib'),
          util: {
            name: 'util',
            type: 'lib',
            data: {
              root: 'libs/util',
              metadata: { js: { packageName: 'util' } },
            },
          },
        },
        dependencies: {},
        externalNodes: {},
      });

      expect(written).toBe(vendoredWorkspaceNamePrunedBunLock);
      expect(manifest.dependencies).toEqual({
        '@demo/lib': 'file:./workspace_modules/@demo/lib',
        util: 'file:local_path_modules/vendor/util',
      });
    });

    // Bun installs none of a linked package's dependencies.
    it('rejects a linked package whose dependencies the app does not declare', () => {
      writeFileSync(
        join(tempDir, 'vendor/lnk/package.json'),
        JSON.stringify({
          name: 'lnk',
          version: '1.0.0',
          dependencies: { ms: '^2.1.0' },
        })
      );

      expect(() => prune(vendoredPackagesRootBunLock, packageJson())).toThrow(
        'linked package lnk requires ms'
      );
    });

    // holder's optional `ms@99.0.0` never resolved, and Bun lists it as
    // unresolved only while the tree holds another `ms`, here debug's.
    it.each([
      {
        scenario: 'beside another ms',
        rootLockFile: unresolvedVendoredKeptRootBunLock,
        dependencies: { debug: '^4.3.0' },
        expected: unresolvedVendoredKeptPrunedBunLock,
      },
      {
        scenario: 'without another ms',
        rootLockFile: unresolvedVendoredDroppedRootBunLock,
        dependencies: { 'is-odd': '^1.0.0' },
        expected: unresolvedVendoredDroppedPrunedBunLock,
      },
    ])(
      "keeps a vendored package's optional dependency unresolved $scenario",
      ({ rootLockFile, dependencies, expected }) => {
        mkdirSync(join(tempDir, 'vendor/holder'), { recursive: true });
        writeFileSync(
          join(tempDir, 'vendor/holder/package.json'),
          JSON.stringify({
            name: 'holder',
            version: '1.0.0',
            optionalDependencies: { ms: '99.0.0' },
          })
        );

        expect(
          prune(rootLockFile, {
            name: '@demo/api',
            version: '1.0.0',
            dependencies: {
              holder: 'file:../../vendor/holder',
              ...dependencies,
            },
          })
        ).toBe(expected);
      }
    );
  });

  it('ships the patches of the packages the pruned bun.lock keeps', () => {
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'demo',
        patchedDependencies: {
          'is-odd@1.0.0': 'custom/is-odd@1.0.0.patch',
          'kind-of@6.0.3': 'patches/kind-of@6.0.3.patch',
        },
      })
    );
    mkdirSync(join(tempDir, 'custom'));
    writeFileSync(join(tempDir, 'custom/is-odd@1.0.0.patch'), 'IS_ODD_PATCH');
    mkdirSync(join(tempDir, 'patches'));
    writeFileSync(
      join(tempDir, 'patches/kind-of@6.0.3.patch'),
      'KIND_OF_PATCH'
    );
    // The app installs kind-of 3.2.2 under is-number, not the patched 6.0.3.
    const packageJson: PackageJson = {
      name: '@demo/api',
      version: '0.0.1',
      dependencies: { 'is-odd': '^1.0.0' },
      patchedDependencies: { 'ms@2.1.3': 'patches/ms.patch' },
    };

    const written = prune(patchedDependenciesRootBunLock, packageJson);

    const shipped = { 'is-odd@1.0.0': 'patches/custom/is-odd@1.0.0.patch' };
    expect(
      parseJson(written, { allowTrailingComma: true }).patchedDependencies
    ).toEqual(shipped);
    expect(packageJson.patchedDependencies).toEqual(shipped);
    expect(
      readFileSync(
        join(tempDir, 'dist/patches/custom/is-odd@1.0.0.patch'),
        'utf-8'
      )
    ).toBe('IS_ODD_PATCH');
    expect(existsSync(join(tempDir, 'dist/patches/kind-of@6.0.3.patch'))).toBe(
      false
    );
  });
});
