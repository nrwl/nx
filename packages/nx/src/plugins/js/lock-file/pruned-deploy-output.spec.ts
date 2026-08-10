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
    vendoredFile = join(tempDir, 'vendor/lib/index.js');
    mkdirSync(join(tempDir, 'vendor/lib'), { recursive: true });
    writeFileSync(vendoredFile, 'VENDORED\n');
    (getPrunedPnpmInstallArtifacts as jest.Mock).mockReturnValue({
      artifacts: [
        { path: 'pnpm-workspace.yaml', content: 'packages: []\n' },
        { path: 'patches/patches/is-number.patch', content: 'THE PATCH\n' },
        {
          path: 'local_path_modules/vendor/lib/index.js',
          sourcePath: vendoredFile,
        },
      ],
      obsolete: [],
    });
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

  it('removes an obsolete artifact a prior deploy left in the output', () => {
    const outputDirectory = join(tempDir, 'dist');
    mkdirSync(outputDirectory);
    const stale = join(outputDirectory, 'pnpm-workspace.yaml');
    writeFileSync(stale, 'allowBuilds:\n  esbuild: true\n');
    (getPrunedPnpmInstallArtifacts as jest.Mock).mockReturnValue({
      artifacts: [],
      obsolete: ['pnpm-workspace.yaml'],
    });

    run(outputDirectory);

    expect(existsSync(stale)).toBe(false);
  });

  it('ships no obsolete path through the emit sink, which only adds assets', () => {
    (getPrunedPnpmInstallArtifacts as jest.Mock).mockReturnValue({
      artifacts: [],
      obsolete: ['pnpm-workspace.yaml'],
    });

    expect([...emit().keys()]).toEqual(['pnpm-lock.yaml']);
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
