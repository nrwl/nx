const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  ...jest.requireActual('child_process'),
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const mockCommitMigrationIfRequested = jest.fn();
const mockCommitCheckpointBeforeMigrations = jest.fn();
jest.mock('./migrate-commits', () => ({
  commitMigrationIfRequested: (...args: unknown[]) =>
    mockCommitMigrationIfRequested(...args),
  commitCheckpointBeforeMigrations: (...args: unknown[]) =>
    mockCommitCheckpointBeforeMigrations(...args),
}));

const mockNgRunMigration = jest.fn();
jest.mock('../../adapter/ngcli-adapter', () => ({
  runMigration: (...args: unknown[]) => mockNgRunMigration(...args),
}));
jest.mock('../../adapter/compat', () => ({}));

const mockCreateProjectGraphAsync = jest.fn();
const mockReadProjectsConfigurationFromProjectGraph = jest.fn();
jest.mock('../../project-graph/project-graph', () => ({
  createProjectGraphAsync: (...args: unknown[]) =>
    mockCreateProjectGraphAsync(...args),
  readProjectsConfigurationFromProjectGraph: (...args: unknown[]) =>
    mockReadProjectsConfigurationFromProjectGraph(...args),
}));

import { EventEmitter } from 'events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type { MigrationsJson } from '../../config/misc-interfaces';
import {
  ChangedDepInstaller,
  executeMigrations,
  getImplementationPath,
  parseMigrationReturn,
  readMigrationCollection,
  runNxOrAngularMigration,
} from './migrate';

function installMigrationPackage(
  root: string,
  pkgName: string,
  migrationsJson: MigrationsJson
): string {
  const pkgDir = join(root, 'node_modules', pkgName);
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, 'package.json'),
    JSON.stringify({
      name: pkgName,
      version: '1.0.0',
      'nx-migrations': './migrations.json',
    })
  );
  writeFileSync(
    join(pkgDir, 'migrations.json'),
    JSON.stringify(migrationsJson)
  );
  return pkgDir;
}

function writeImplFile(pkgDir: string, relPath: string, source: string): void {
  const abs = join(pkgDir, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, source);
}

// child_process.spawn returns an EventEmitter with a `.stderr` stream; tests
// drive install outcomes by emitting on these directly.
class FakeChildProcess extends EventEmitter {
  stderr: EventEmitter | null;
  constructor(withStderr = false) {
    super();
    this.stderr = withStderr ? new EventEmitter() : null;
  }
}

afterEach(() => {
  jest.resetAllMocks();
});

describe('parseMigrationReturn', () => {
  it.each<[string, unknown, { nextSteps: string[]; agentContext: string[] }]>([
    [
      'returns an array of strings as nextSteps with an empty agentContext',
      ['a', 'b'],
      { nextSteps: ['a', 'b'], agentContext: [] },
    ],
    [
      'filters non-string entries out of an array return value',
      ['a', 1, null, 'b', undefined, {}],
      { nextSteps: ['a', 'b'], agentContext: [] },
    ],
    [
      'filters non-string entries out of both nextSteps and agentContext',
      { nextSteps: ['x', 2], agentContext: ['y', false] },
      { nextSteps: ['x'], agentContext: ['y'] },
    ],
    [
      'returns empty arrays for an object missing both keys',
      {},
      { nextSteps: [], agentContext: [] },
    ],
    [
      'returns empty arrays for an object with unrelated keys',
      { foo: 'bar' },
      { nextSteps: [], agentContext: [] },
    ],
    [
      'returns empty arrays for undefined',
      undefined,
      { nextSteps: [], agentContext: [] },
    ],
    [
      'returns empty arrays for null',
      null,
      { nextSteps: [], agentContext: [] },
    ],
    [
      'returns empty arrays for a number',
      42,
      { nextSteps: [], agentContext: [] },
    ],
    [
      'returns empty arrays for a function',
      () => {},
      { nextSteps: [], agentContext: [] },
    ],
  ])('%s', (_title, input, expected) => {
    expect(parseMigrationReturn(input)).toEqual(expected);
  });
});

describe('readMigrationCollection and getImplementationPath', () => {
  let tmpRoot: string;

  beforeEach(() => {
    // realpath so path assertions aren't defeated by the macOS /tmp ->
    // /private/tmp symlink (require.resolve returns realpaths).
    tmpRoot = realpathSync(
      mkdtempSync(join(tmpdir(), 'nx-migrate-collection-'))
    );
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('defaults collection.name to the package name when the migrations.json has none', () => {
    installMigrationPackage(tmpRoot, 'pkg-a', { generators: {} });

    const { collection } = readMigrationCollection('pkg-a', tmpRoot);

    expect(collection.name).toBe('pkg-a');
  });

  it('prefers a generators entry over a schematics entry with the same name', () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-b', {
      generators: {
        mig: { version: '1.0.0', implementation: './gen-impl.js' },
      },
      schematics: {
        mig: { version: '1.0.0', implementation: './schem-impl.js' },
      },
    });
    writeImplFile(pkgDir, 'gen-impl.js', '');
    writeImplFile(pkgDir, 'schem-impl.js', '');

    const { collection, collectionPath } = readMigrationCollection(
      'pkg-b',
      tmpRoot
    );
    const { path } = getImplementationPath(collection, collectionPath, 'mig');

    expect(path).toBe(join(pkgDir, 'gen-impl.js'));
  });

  it('prefers the implementation field over factory on the same entry', () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-c', {
      generators: {
        mig: {
          version: '1.0.0',
          implementation: './impl.js',
          factory: './factory.js',
        },
      },
    });
    writeImplFile(pkgDir, 'impl.js', '');
    writeImplFile(pkgDir, 'factory.js', '');

    const { collection, collectionPath } = readMigrationCollection(
      'pkg-c',
      tmpRoot
    );
    const { path } = getImplementationPath(collection, collectionPath, 'mig');

    expect(path).toBe(join(pkgDir, 'impl.js'));
  });

  it('defaults fnSymbol to "default" when the implementation has no #symbol suffix', () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-d', {
      generators: { mig: { version: '1.0.0', implementation: './impl.js' } },
    });
    writeImplFile(pkgDir, 'impl.js', '');

    const { collection, collectionPath } = readMigrationCollection(
      'pkg-d',
      tmpRoot
    );
    const { fnSymbol } = getImplementationPath(
      collection,
      collectionPath,
      'mig'
    );

    expect(fnSymbol).toBe('default');
  });

  it('parses the #symbol suffix off the implementation path', () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-e', {
      generators: {
        mig: { version: '1.0.0', implementation: './impl.js#customExport' },
      },
    });
    writeImplFile(pkgDir, 'impl.js', '');

    const { collection, collectionPath } = readMigrationCollection(
      'pkg-e',
      tmpRoot
    );
    const { path, fnSymbol } = getImplementationPath(
      collection,
      collectionPath,
      'mig'
    );

    expect(path).toBe(join(pkgDir, 'impl.js'));
    expect(fnSymbol).toBe('customExport');
  });

  it('throws MigrationImplementationMissingError when the implementation cannot be resolved', () => {
    installMigrationPackage(tmpRoot, 'pkg-f', {
      generators: { mig: { version: '1.0.0', implementation: './missing.js' } },
    });

    const { collection, collectionPath } = readMigrationCollection(
      'pkg-f',
      tmpRoot
    );
    let thrown: unknown;
    try {
      getImplementationPath(collection, collectionPath, 'mig');
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).name).toBe('MigrationImplementationMissingError');
  });
});

describe('runNxOrAngularMigration', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nx-migrate-run-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('runs the generator implementation, flushes changes to disk, and returns its next steps and agent context', async () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-gen', {
      generators: {
        'add-file': { version: '1.0.0', implementation: './impl.js' },
      },
    });
    writeImplFile(
      pkgDir,
      'impl.js',
      `module.exports.default = async function (tree) {
        tree.write('generated.txt', 'hello');
        return { nextSteps: ['step one'], agentContext: ['ctx one'] };
      };`
    );

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'pkg-gen', name: 'add-file', version: '1.0.0' },
      false
    );

    expect(result.madeChanges).toBe(true);
    expect(result.nextSteps).toEqual(['step one']);
    expect(result.agentContext).toEqual(['ctx one']);
    expect(existsSync(join(tmpRoot, 'generated.txt'))).toBe(true);
    expect(readFileSync(join(tmpRoot, 'generated.txt'), 'utf-8')).toBe('hello');
    expect(mockNgRunMigration).not.toHaveBeenCalled();
  });

  it('reports no changes for a no-op implementation', async () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-noop', {
      generators: { noop: { version: '1.0.0', implementation: './impl.js' } },
    });
    writeImplFile(
      pkgDir,
      'impl.js',
      `module.exports.default = async function () {
        return [];
      };`
    );

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'pkg-noop', name: 'noop', version: '1.0.0' },
      false
    );

    expect(result.madeChanges).toBe(false);
    expect(result.changes).toEqual([]);
  });

  it('captures console output from the generator into logs when captureGeneratorOutput is true', async () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-logs', {
      generators: {
        'with-logs': { version: '1.0.0', implementation: './impl.js' },
      },
    });
    writeImplFile(
      pkgDir,
      'impl.js',
      `module.exports.default = async function (tree) {
        console.log('log line from migration');
        tree.write('a.txt', 'x');
        return [];
      };`
    );

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'pkg-logs', name: 'with-logs', version: '1.0.0' },
      false,
      true
    );

    expect(result.logs).toContain('log line from migration');
  });

  it('uses a passed-in resolvedCollection without re-reading the package from node_modules', async () => {
    // No node_modules entry exists for this package at all.
    const collectionDir = join(tmpRoot, 'external-collection');
    mkdirSync(collectionDir, { recursive: true });
    writeFileSync(
      join(collectionDir, 'impl.js'),
      `module.exports.default = async function (tree) {
        tree.write('from-external.txt', 'y');
        return [];
      };`
    );
    const collectionPath = join(collectionDir, 'migrations.json');
    const collection: MigrationsJson = {
      generators: {
        'ext-mig': { version: '1.0.0', implementation: './impl.js' },
      },
    };
    writeFileSync(collectionPath, JSON.stringify(collection));

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'not-installed-anywhere', name: 'ext-mig', version: '1.0.0' },
      false,
      false,
      { collection, collectionPath }
    );

    expect(result.madeChanges).toBe(true);
    expect(existsSync(join(tmpRoot, 'from-external.txt'))).toBe(true);
  });

  it('dispatches to the Angular compat layer when the collection has only a schematics entry', async () => {
    installMigrationPackage(tmpRoot, 'pkg-ng', {
      schematics: {
        'ng-mig': { version: '1.0.0', factory: './does-not-matter' },
      },
    });
    mockCreateProjectGraphAsync.mockResolvedValue({});
    mockReadProjectsConfigurationFromProjectGraph.mockReturnValue({
      projects: {},
    });
    mockNgRunMigration.mockResolvedValue({
      changes: [{ type: 'CREATE', path: 'x.ts', content: Buffer.from('') }],
      madeChanges: true,
      loggingQueue: ['a', 'b'],
    });

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'pkg-ng', name: 'ng-mig', version: '1.0.0' },
      false
    );

    expect(mockNgRunMigration).toHaveBeenCalledTimes(1);
    expect(result.madeChanges).toBe(true);
    expect(result.logs).toBe('a\nb');
    expect(result.changes).toHaveLength(1);
    expect(result.nextSteps).toEqual([]);
    expect(result.agentContext).toEqual([]);
  });
});

describe('ChangedDepInstaller', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nx-migrate-deps-'));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const writePackageJson = (extra: Record<string, unknown> = {}): void => {
    writeFileSync(
      join(tmpRoot, 'package.json'),
      JSON.stringify({
        name: 'workspace',
        version: '0.0.0',
        dependencies: { foo: '1.0.0' },
        ...extra,
      })
    );
  };

  it('does not install when dependencies are unchanged', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot);

    await installer.installDepsIfChanged();

    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('skips the install and reports skippedInstall when shouldSkipInstall is true', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, true);
    writePackageJson({ dependencies: { foo: '2.0.0' } });

    await installer.installDepsIfChanged();

    expect(installer.skippedInstall).toBe(true);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('spawns the install command when dependencies changed', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, false);
    writePackageJson({ dependencies: { foo: '2.0.0' } });
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child);

    const promise = installer.installDepsIfChanged();
    child.emit('close', 0);
    await promise;

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    expect(mockSpawn.mock.calls[0][0]).toContain('install');
  });

  it('does not spawn a second install when nothing changes after a prior install', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, false);
    writePackageJson({ dependencies: { foo: '2.0.0' } });
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child);

    const firstInstall = installer.installDepsIfChanged();
    child.emit('close', 0);
    await firstInstall;

    await installer.installDepsIfChanged();

    expect(mockSpawn).toHaveBeenCalledTimes(1);
  });

  it('treats a missing package.json as an empty dependency set, so writing one counts as a change', async () => {
    // tmpRoot has no package.json at construction time.
    const installer = new ChangedDepInstaller(tmpRoot, true);
    writePackageJson();

    await installer.installDepsIfChanged();

    expect(installer.skippedInstall).toBe(true);
  });

  describe('install error classification', () => {
    beforeEach(() => {
      // package-lock.json makes detectPackageManager resolve to npm, which is
      // the only package manager whose stderr is inspected for classification.
      writeFileSync(join(tmpRoot, 'package-lock.json'), '{}');
    });

    it('rejects with NpmPeerDepsInstallError when npm stderr reports ERESOLVE', async () => {
      writePackageJson();
      const installer = new ChangedDepInstaller(tmpRoot, false);
      writePackageJson({ dependencies: { foo: '2.0.0' } });
      const child = new FakeChildProcess(true);
      mockSpawn.mockReturnValue(child);

      const promise = installer.installDepsIfChanged();
      child.stderr!.emit(
        'data',
        Buffer.from('npm ERR! code ERESOLVE\nunable to resolve dependency tree')
      );
      child.emit('close', 1);

      await expect(promise).rejects.toMatchObject({
        name: 'NpmPeerDepsInstallError',
      });
    });

    it('rejects with a generic command-failed error for non-ERESOLVE npm failures', async () => {
      writePackageJson();
      const installer = new ChangedDepInstaller(tmpRoot, false);
      writePackageJson({ dependencies: { foo: '2.0.0' } });
      const child = new FakeChildProcess(true);
      mockSpawn.mockReturnValue(child);

      const promise = installer.installDepsIfChanged();
      child.stderr!.emit('data', Buffer.from('npm ERR! some other failure'));
      child.emit('close', 1);

      await expect(promise).rejects.toThrow(/^Command failed:/);
    });
  });
});

describe('executeMigrations', () => {
  let tmpRoot: string;
  let pkgDir: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'nx-migrate-execute-'));
    pkgDir = installMigrationPackage(tmpRoot, 'exec-plugin', {
      generators: {
        'mig-a': { version: '1.0.0', implementation: './mig-a.js' },
        'mig-b': { version: '1.0.0', implementation: './mig-b.js' },
        'mig-c': { version: '1.0.0', implementation: './mig-c.js' },
        '15-7-0-split-configuration-into-project-json-files': {
          version: '1.0.0',
          implementation: './split.js',
        },
      },
    });
    for (const name of ['mig-a', 'mig-b', 'mig-c', 'split']) {
      writeImplFile(
        pkgDir,
        `${name}.js`,
        `module.exports.default = async function (tree) {
          tree.write('${name}.txt', '${name}');
          return [];
        };`
      );
    }
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  const migration = (name: string, version: string) => ({
    package: 'exec-plugin',
    name,
    version,
  });

  it('runs migrations in ascending version order regardless of input order', async () => {
    mockCommitMigrationIfRequested.mockResolvedValue({
      status: 'committed',
      sha: 'sha',
    });

    await executeMigrations(
      tmpRoot,
      [
        migration('mig-c', '3.0.0'),
        migration('mig-a', '1.0.0'),
        migration('mig-b', '2.0.0'),
      ],
      false,
      true,
      'chore(repo): ',
      true
    );

    const order = mockCommitMigrationIfRequested.mock.calls.map(
      (call) => call[1].name
    );
    expect(order).toEqual(['mig-a', 'mig-b', 'mig-c']);
  });

  it('always runs the split-configuration migration first regardless of version', async () => {
    mockCommitMigrationIfRequested.mockResolvedValue({
      status: 'committed',
      sha: 'sha',
    });

    await executeMigrations(
      tmpRoot,
      [
        migration('mig-a', '1.0.0'),
        migration(
          '15-7-0-split-configuration-into-project-json-files',
          '99.0.0'
        ),
      ],
      false,
      true,
      'chore(repo): ',
      true
    );

    const order = mockCommitMigrationIfRequested.mock.calls.map(
      (call) => call[1].name
    );
    expect(order[0]).toBe('15-7-0-split-configuration-into-project-json-files');
  });

  it('passes prior failed-commit migrations as pending to the next commit, and clears them once absorbed', async () => {
    mockCommitMigrationIfRequested
      .mockResolvedValueOnce({ status: 'failed', reason: 'boom' })
      .mockResolvedValueOnce({ status: 'committed', sha: 'abc' })
      .mockResolvedValueOnce({ status: 'committed', sha: 'def' });

    await executeMigrations(
      tmpRoot,
      [
        migration('mig-a', '1.0.0'),
        migration('mig-b', '2.0.0'),
        migration('mig-c', '3.0.0'),
      ],
      false,
      true,
      'chore(repo): ',
      true
    );

    expect(mockCommitMigrationIfRequested.mock.calls[0][5]).toEqual([]);
    expect(mockCommitMigrationIfRequested.mock.calls[1][5]).toEqual([
      { package: 'exec-plugin', name: 'mig-a' },
    ]);
    expect(mockCommitMigrationIfRequested.mock.calls[2][5]).toEqual([]);
  });

  it('does not carry no-changes or disabled commit results into a later pending list', async () => {
    mockCommitMigrationIfRequested
      .mockResolvedValueOnce({ status: 'no-changes' })
      .mockResolvedValueOnce({ status: 'disabled' })
      .mockResolvedValueOnce({ status: 'committed', sha: 'xyz' });

    await executeMigrations(
      tmpRoot,
      [
        migration('mig-a', '1.0.0'),
        migration('mig-b', '2.0.0'),
        migration('mig-c', '3.0.0'),
      ],
      false,
      true,
      'chore(repo): ',
      true
    );

    expect(mockCommitMigrationIfRequested.mock.calls[2][5]).toEqual([]);
  });
});
