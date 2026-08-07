import type { ProjectGraph } from '../../../config/project-graph';
import type { PackageJson } from '../../../utils/package-json';
import { createLockFile, createPrunedLockfile } from './lock-file';
import { stringifyNpmLockfile } from './npm-parser';
import { stringifyPnpmLockfile } from './pnpm-parser';
import {
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
} from './pruned-output';

jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  readFileSync: jest.fn(() => 'ROOT_LOCKFILE'),
}));
jest.mock('./pnpm-parser', () => ({
  ...jest.requireActual('./pnpm-parser'),
  stringifyPnpmLockfile: jest.fn(() => 'PRUNED_LOCKFILE'),
}));
jest.mock('./npm-parser', () => ({
  ...jest.requireActual('./npm-parser'),
  stringifyNpmLockfile: jest.fn(() => 'PRUNED_NPM_LOCKFILE'),
}));
jest.mock('./project-graph-pruning', () => ({
  ...jest.requireActual('./project-graph-pruning'),
  pruneProjectGraph: jest.fn((graph) => graph),
}));
jest.mock('./pruned-output', () => ({
  ...jest.requireActual('./pruned-output'),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
}));
jest.mock('../../../utils/output', () => ({
  output: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

describe('createLockFile', () => {
  const graph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };

  afterEach(() => {
    jest.clearAllMocks();
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

  it('keeps the pnpm config when pruning falls back to the root lockfile', () => {
    (stringifyPnpmLockfile as jest.Mock).mockImplementationOnce(() => {
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

      throw new Error('prune failed');
    });
    const packageJson: PackageJson = {
      name: 'app',
      version: '1.0.0',
      pnpm: { overrides: { foo: '1.0.0' } },
    };

    expect(createLockFile(packageJson, graph, 'pnpm')).toBe('ROOT_LOCKFILE');

    expect(packageJson.pnpm).toEqual({ overrides: { foo: '1.0.0' } });
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
});

describe('createPrunedLockfile', () => {
  let packageJson: PackageJson;
  const graph: ProjectGraph = {
    nodes: {},
    dependencies: {},
    externalNodes: {},
  };

  beforeEach(() => {
    packageJson = { name: 'app', version: '1.0.0' };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('relocates local-path specifiers, prunes, and validates the closure for pnpm', () => {
    const result = createPrunedLockfile(
      packageJson,
      graph,
      'apps/app',
      '/root',
      'pnpm'
    );

    expect(rewritePrunedLocalPathSpecifiers).toHaveBeenCalledWith(
      packageJson,
      'apps/app',
      '/root',
      new Set()
    );
    // the relocation must land in the manifest before the lockfile copies its
    // specifiers
    expect(
      (rewritePrunedLocalPathSpecifiers as jest.Mock).mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      (stringifyPnpmLockfile as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(validatePrunedLocalPathClosure).toHaveBeenCalledWith(
      packageJson,
      '/root',
      'PRUNED_LOCKFILE'
    );
    expect(result).toEqual({
      lockFileContent: 'PRUNED_LOCKFILE',
      pruned: true,
    });
  });

  it('strips the baked pnpm config from the manifest after a successful prune', () => {
    packageJson.pnpm = {
      overrides: { foo: '1.0.0' },
      ignoredOptionalDependencies: ['fsevents'],
      packageExtensions: { 'foo@1': { dependencies: { bar: '1.0.0' } } },
      patchedDependencies: { 'foo@1.0.0': 'my-patches/foo.patch' },
      onlyBuiltDependencies: ['sharp'],
    };

    const { pruned } = createPrunedLockfile(
      packageJson,
      graph,
      'apps/app',
      '/root',
      'pnpm'
    );

    expect(pruned).toBe(true);
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
    (stringifyPnpmLockfile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    const { pruned } = createPrunedLockfile(
      packageJson,
      graph,
      'apps/app',
      '/root',
      'pnpm'
    );

    expect(pruned).toBe(false);
    // The root lockfile still declares the resolution-time config, but the
    // patch paths are the workspace's and no patch file ships unless the sinks
    // scope one out of that lockfile.
    expect(packageJson.pnpm).toEqual({ overrides: { foo: '1.0.0' } });
  });

  it('drops an emptied pnpm block with the inherited patch declaration', () => {
    packageJson.pnpm = {
      patchedDependencies: { 'foo@1.0.0': 'patches/foo.patch' },
    };

    createPrunedLockfile(packageJson, graph, 'apps/app', '/root', 'pnpm');

    expect(packageJson.pnpm).toBeUndefined();
  });

  it('skips the pnpm-only steps for npm', () => {
    const result = createPrunedLockfile(
      packageJson,
      graph,
      'apps/app',
      '/root',
      'npm'
    );

    expect(rewritePrunedLocalPathSpecifiers).not.toHaveBeenCalled();
    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(result).toEqual({
      lockFileContent: 'PRUNED_NPM_LOCKFILE',
      pruned: true,
    });
  });

  it('returns the root lockfile unvalidated when pruning falls back', () => {
    (stringifyPnpmLockfile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    const result = createPrunedLockfile(
      packageJson,
      graph,
      'apps/app',
      '/root',
      'pnpm'
    );

    expect(validatePrunedLocalPathClosure).not.toHaveBeenCalled();
    expect(result).toEqual({
      lockFileContent: 'ROOT_LOCKFILE',
      pruned: false,
    });
  });

  it('rolls back the manifest mutations when pruning falls back', () => {
    packageJson.dependencies = { 'vendored-lib': 'file:../../vendor/lib' };
    packageJson.pnpm = { overrides: { foo: '1.0.0' } };
    const original = structuredClone(packageJson);
    (rewritePrunedLocalPathSpecifiers as jest.Mock).mockImplementationOnce(
      (pj: PackageJson) => {
        pj.dependencies['vendored-lib'] = 'file:local_path_modules/vendor/lib';
      }
    );
    (stringifyPnpmLockfile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('pruning failed');
    });

    createPrunedLockfile(packageJson, graph, 'apps/app', '/root', 'pnpm');

    // The root lockfile matches the manifest as authored: the local-path
    // specifier must not point at unshipped local_path_modules/, and the pnpm
    // config the root lockfile still declares must be kept.
    expect(packageJson).toEqual(original);
    const { output } = require('../../../utils/output');
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
    (stringifyNpmLockfile as jest.Mock).mockImplementationOnce(() => {
      throw new Error('npm pruning failed');
    });

    createPrunedLockfile(packageJson, graph, 'apps/app', '/root', 'npm');

    const { output } = require('../../../utils/output');
    const [{ bodyLines }] = (output.warn as jest.Mock).mock.calls[0];
    // the cause and the npm remediation, and none of the pnpm-only claims
    expect(bodyLines).toEqual([
      'The lockfile pruning failed: npm pruning failed',
      '`npm ci` in the output will fail; run `npm install` instead.',
    ]);
  });
});
