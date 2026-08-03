import type { ProjectGraph } from '../../../config/project-graph';
import type { PackageJson } from '../../../utils/package-json';
import { createPrunedLockfile } from './lock-file';
import { stringifyNpmLockfile } from './npm-parser';
import { stringifyPnpmLockfile } from './pnpm-parser';
import {
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
} from '../../../utils/package-json';

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
jest.mock('../../../utils/package-json', () => ({
  ...jest.requireActual('../../../utils/package-json'),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
}));
jest.mock('../../../utils/output', () => ({
  output: { log: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

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
    // into the pruned lockfile; build-script approvals are not, so they stay.
    expect(packageJson.pnpm).toEqual({ onlyBuiltDependencies: ['sharp'] });
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
