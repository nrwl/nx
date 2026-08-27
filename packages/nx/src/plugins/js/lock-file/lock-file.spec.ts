import type { ProjectGraph } from '../../../config/project-graph';
import { output } from '../../../utils/output';
import type { PackageJson } from '../../../utils/package-json';
import { createLockFile, generatePrunedDeployOutput } from './lock-file';
import { stringifyNpmLockfile } from './npm-parser';
import { stringifyPnpmLockfile } from './pnpm-parser';
import {
  getPrunedPnpmInstallArtifacts,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
  warnIncompletePrunedPnpmOutput,
} from './pruned-output';

vi.mock('node:fs', async () => ({
  ...(await vi.importActual('node:fs')),
  readFileSync: vi.fn(() => 'ROOT_LOCKFILE'),
}));
vi.mock('./pnpm-parser', async () => ({
  ...(await vi.importActual('./pnpm-parser')),
  stringifyPnpmLockfile: vi.fn(() => 'PRUNED_LOCKFILE'),
}));
vi.mock('./npm-parser', async () => ({
  ...(await vi.importActual('./npm-parser')),
  stringifyNpmLockfile: vi.fn(() => 'PRUNED_NPM_LOCKFILE'),
}));
vi.mock('./project-graph-pruning', async () => ({
  ...(await vi.importActual('./project-graph-pruning')),
  pruneProjectGraph: vi.fn((graph) => graph),
}));
vi.mock('./pruned-output', async () => ({
  ...(await vi.importActual('./pruned-output')),
  getPrunedPnpmInstallArtifacts: vi.fn(() => []),
  rewritePrunedLocalPathSpecifiers: vi.fn(),
  validatePrunedLocalPathClosure: vi.fn(),
  warnIncompletePrunedPnpmOutput: vi.fn(),
}));
vi.mock('../../../utils/output', () => ({
  output: { log: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

describe('createLockFile', () => {
  const graph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('drops the pnpm config the pruned lockfile no longer declares', () => {
    // pnpm 10 and below validate the manifest against the lockfile, so a
    // manifest still declaring what the prune baked into its snapshots aborts a
    // frozen install with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
    const packageJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      pnpm: {
        overrides: { foo: '1.0.0' },
        ignoredOptionalDependencies: ['fsevents'],
        packageExtensions: { 'foo@1': { dependencies: { bar: '1.0.0' } } },
        onlyBuiltDependencies: ['sharp'],
      },
    };

    expect(createLockFile(packageJson, graph, 'pnpm')).toBe('PRUNED_LOCKFILE');

    expect(packageJson.pnpm).toEqual({ onlyBuiltDependencies: ['sharp'] });
  });

  it('drops an inherited patchedDependencies the pruned lockfile rescopes', () => {
    // The prune scopes the lockfile's patches to the packages that survive it
    // and rewrites their paths, so a manifest keeping the workspace's own set
    // disagrees with it. Both sides empty still installs; a stale manifest side
    // does not.
    const packageJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      pnpm: {
        patchedDependencies: { 'is-number@7.0.0': 'patches/is-number.patch' },
      },
    };

    createLockFile(packageJson, graph, 'pnpm');

    expect(packageJson.pnpm).toBeUndefined();
  });

  it('keeps the pnpm config when pruning falls back to the root lockfile', () => {
    (stringifyPnpmLockfile as Mock).mockImplementationOnce(() => {
      throw new Error('prune failed');
    });
    const packageJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      pnpm: { overrides: { foo: '1.0.0' } },
    };

    expect(createLockFile(packageJson, graph, 'pnpm')).toBe('ROOT_LOCKFILE');

    expect(packageJson.pnpm).toEqual({ overrides: { foo: '1.0.0' } });
    expect(warnIncompletePrunedPnpmOutput).not.toHaveBeenCalled();
  });

  it('leaves the manifest alone for npm, which never reads the pnpm block', () => {
    const packageJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      pnpm: { overrides: { foo: '1.0.0' } },
    };

    expect(createLockFile(packageJson, graph, 'npm')).toBe(
      'PRUNED_NPM_LOCKFILE'
    );

    expect(packageJson.pnpm).toEqual({ overrides: { foo: '1.0.0' } });
  });

  it('warns that the returned lockfile is missing its install-time artifacts', () => {
    createLockFile({ name: 'app', version: '1.0.0' }, graph, 'pnpm');

    expect(warnIncompletePrunedPnpmOutput).toHaveBeenCalledWith(
      'PRUNED_LOCKFILE'
    );
  });

  it('does not warn about missing artifacts for a package manager without them', () => {
    createLockFile({ name: 'app', version: '1.0.0' }, graph, 'npm');

    expect(warnIncompletePrunedPnpmOutput).not.toHaveBeenCalled();
  });
});

describe('generatePrunedDeployOutput', () => {
  let packageJson: PackageJson;
  const graph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };

  let emitted: Array<{ path: string; content: string | Buffer }>;
  const emit = (path: string, content: string | Buffer) =>
    emitted.push({ path, content });

  beforeEach(() => {
    packageJson = { name: 'app', version: '1.0.0' };
    emitted = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('relocates local-path specifiers, prunes, and validates the closure for pnpm', () => {
    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    expect(rewritePrunedLocalPathSpecifiers).toHaveBeenCalledWith(
      packageJson,
      'apps/app',
      '/root',
      new Set()
    );
    // the relocation must land in the manifest before the lockfile copies its
    // specifiers
    expect(
      (rewritePrunedLocalPathSpecifiers as Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((stringifyPnpmLockfile as Mock).mock.invocationCallOrder[0]);
    expect(validatePrunedLocalPathClosure).toHaveBeenCalledWith(
      packageJson,
      '/root',
      'PRUNED_LOCKFILE'
    );
    expect(emitted).toContainEqual({
      path: 'pnpm-lock.yaml',
      content: 'PRUNED_LOCKFILE',
    });
    expect(getPrunedPnpmInstallArtifacts).toHaveBeenCalledWith(
      '/root',
      'PRUNED_LOCKFILE',
      packageJson,
      { includeLocalPathArtifacts: true }
    );
  });

  it('strips the baked pnpm config from the manifest after a successful prune', () => {
    packageJson.pnpm = {
      overrides: { foo: '1.0.0' },
      ignoredOptionalDependencies: ['fsevents'],
      packageExtensions: { 'foo@1': { dependencies: { bar: '1.0.0' } } },
      patchedDependencies: { 'foo@1.0.0': 'my-patches/foo.patch' },
      onlyBuiltDependencies: ['sharp'],
    };

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    // overrides, ignoredOptionalDependencies, and packageExtensions are baked
    // into the pruned lockfile, and the patch declaration comes from the
    // install-settings sinks; build-script approvals are not, so they stay.
    expect(packageJson.pnpm).toEqual({ onlyBuiltDependencies: ['sharp'] });
  });

  it('drops an inherited patch declaration when pruning falls back', () => {
    packageJson.pnpm = {
      overrides: { foo: '1.0.0' },
      patchedDependencies: { 'foo@1.0.0': 'my-patches/foo.patch' },
    };
    (stringifyPnpmLockfile as Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    // The root lockfile still declares the resolution-time config, but the
    // patch paths are the workspace's and no patch file ships unless the sinks
    // scope one out of that lockfile.
    expect(packageJson.pnpm).toEqual({ overrides: { foo: '1.0.0' } });
  });

  it('drops an emptied pnpm block with the inherited patch declaration', () => {
    packageJson.pnpm = {
      patchedDependencies: { 'foo@1.0.0': 'patches/foo.patch' },
    };

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    expect(packageJson.pnpm).toBeUndefined();
  });

  it('skips the pnpm-only steps for npm', () => {
    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'npm',
      workspaceRoot: '/root',
    });

    expect(rewritePrunedLocalPathSpecifiers).not.toHaveBeenCalled();
    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(getPrunedPnpmInstallArtifacts).not.toHaveBeenCalled();
    expect(emitted).toEqual([
      { path: 'package-lock.json', content: 'PRUNED_NPM_LOCKFILE' },
    ]);
  });

  it('ships the root lockfile without its local-path artifacts when pruning falls back', () => {
    (stringifyPnpmLockfile as Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(emitted).toContainEqual({
      path: 'pnpm-lock.yaml',
      content: 'ROOT_LOCKFILE',
    });
    // The fallback importer describes the whole workspace, so its local-path
    // trees must not ship into the output.
    expect(getPrunedPnpmInstallArtifacts).toHaveBeenCalledWith(
      '/root',
      'ROOT_LOCKFILE',
      packageJson,
      { includeLocalPathArtifacts: false }
    );
  });

  it('rolls back the manifest mutations when pruning falls back', () => {
    packageJson.dependencies = { 'vendored-lib': 'file:../../vendor/lib' };
    packageJson.pnpm = { overrides: { foo: '1.0.0' } };
    const original = structuredClone(packageJson);
    (rewritePrunedLocalPathSpecifiers as Mock).mockImplementationOnce(
      (pj: PackageJson) => {
        pj.dependencies['vendored-lib'] = 'file:local_path_modules/vendor/lib';
      }
    );
    (stringifyPnpmLockfile as Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'pnpm',
      workspaceRoot: '/root',
    });

    // The root lockfile matches the manifest as authored: the local-path
    // specifier must not point at unshipped local_path_modules/, and the pnpm
    // config the root lockfile still declares must be kept.
    expect(packageJson).toEqual(original);
    expect(output.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('falls back to the root lockfile'),
        bodyLines: [
          expect.stringContaining('pruning failed'),
          expect.stringContaining('pnpm config'),
          expect.stringContaining('`--frozen-lockfile`'),
        ],
      })
    );
  });

  it('warns without pnpm-specific guidance when an npm prune falls back', () => {
    (stringifyNpmLockfile as Mock).mockImplementationOnce(() => {
      throw new Error('npm pruning failed');
    });

    generatePrunedDeployOutput(packageJson, graph, 'apps/app', {
      emit,
      packageManager: 'npm',
      workspaceRoot: '/root',
    });

    const [{ bodyLines }] = (output.warn as Mock).mock.calls[0];
    // the cause and the npm remediation, and none of the pnpm-only claims
    expect(bodyLines).toEqual([
      'The lockfile pruning failed: npm pruning failed',
      '`npm ci` in the output will fail; run `npm install` instead.',
    ]);
  });
});
