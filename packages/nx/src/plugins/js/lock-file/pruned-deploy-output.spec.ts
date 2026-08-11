import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { ProjectGraph } from '../../../config/project-graph';
import { output } from '../../../utils/output';
import type { PackageJson } from '../../../utils/package-json';
import { generatePrunedDeployOutput } from './lock-file';
import { stringifyPnpmLockfile } from './pnpm-parser';
import { getPrunedPnpmInstallArtifacts } from './pruned-output';

jest.mock('./pnpm-parser', () => ({
  ...jest.requireActual('./pnpm-parser'),
  stringifyPnpmLockfile: jest.fn(() => 'PRUNED_LOCKFILE'),
}));
jest.mock('./project-graph-pruning', () => ({
  ...jest.requireActual('./project-graph-pruning'),
  pruneProjectGraph: jest.fn((graph) => graph),
}));
jest.mock('./pruned-output', () => ({
  ...jest.requireActual('./pruned-output'),
  getPrunedPnpmInstallArtifacts: jest.fn(),
  rewritePrunedLocalPathSpecifiers: jest.fn(),
  validatePrunedLocalPathClosure: jest.fn(),
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
    (getPrunedPnpmInstallArtifacts as jest.Mock).mockReturnValue([
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
    jest.clearAllMocks();
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
      tempDir
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

  it('ships nothing for bun and leaves the manifest as authored', () => {
    const warn = jest.spyOn(output, 'warn').mockImplementation(() => {});
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
