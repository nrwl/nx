import type { ProjectGraph } from '../../../config/project-graph';
import type { PackageJson } from '../../../utils/package-json';
import { createPrunedLockfile } from './lock-file';
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
  output: { log: jest.fn(), error: jest.fn() },
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
});
