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

const mockRunAgenticPromptStep = jest.fn();
jest.mock('./agentic/run-step', () => ({
  runAgenticPromptStep: (...args: unknown[]) =>
    mockRunAgenticPromptStep(...args),
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
import { logger } from '../../utils/logger';
import { output } from '../../utils/output';
import type { ResolvedAgentic } from './agentic/types';
import {
  ChangedDepInstaller,
  executeMigrations,
  formatSingleMigrationRerunCommand,
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
  it.each<
    [
      string,
      unknown,
      { nextSteps: string[]; agentContext: string[]; skipAgentic: boolean },
    ]
  >([
    [
      'returns an array of strings as nextSteps with an empty agentContext',
      ['a', 'b'],
      { nextSteps: ['a', 'b'], agentContext: [], skipAgentic: false },
    ],
    [
      'filters non-string entries out of an array return value',
      ['a', 1, null, 'b', undefined, {}],
      { nextSteps: ['a', 'b'], agentContext: [], skipAgentic: false },
    ],
    [
      'filters non-string entries out of both nextSteps and agentContext',
      { nextSteps: ['x', 2], agentContext: ['y', false] },
      { nextSteps: ['x'], agentContext: ['y'], skipAgentic: false },
    ],
    [
      'returns empty arrays for an object missing both keys',
      {},
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'returns empty arrays for an object with unrelated keys',
      { foo: 'bar' },
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'returns empty arrays for undefined',
      undefined,
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'returns empty arrays for null',
      null,
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'returns empty arrays for a number',
      42,
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'returns empty arrays for a function',
      () => {},
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'reads skipAgentic: true alongside the other buckets',
      { nextSteps: ['a'], agentContext: ['b'], skipAgentic: true },
      { nextSteps: ['a'], agentContext: ['b'], skipAgentic: true },
    ],
    [
      'reads skipAgentic: true on its own',
      { skipAgentic: true },
      { nextSteps: [], agentContext: [], skipAgentic: true },
    ],
    [
      'reads an explicit skipAgentic: false',
      { skipAgentic: false },
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'does not let a truthy string opt out of the AI step',
      { skipAgentic: 'yes' },
      { nextSteps: [], agentContext: [], skipAgentic: false },
    ],
    [
      'does not let a truthy number opt out of the AI step',
      { skipAgentic: 1 },
      { nextSteps: [], agentContext: [], skipAgentic: false },
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
    expect(result.skipAgentic).toBe(false);
    expect(existsSync(join(tmpRoot, 'generated.txt'))).toBe(true);
    expect(readFileSync(join(tmpRoot, 'generated.txt'), 'utf-8')).toBe('hello');
    expect(mockNgRunMigration).not.toHaveBeenCalled();
  });

  it('surfaces skipAgentic from the generator return value', async () => {
    const pkgDir = installMigrationPackage(tmpRoot, 'pkg-waive', {
      generators: {
        waive: { version: '1.0.0', implementation: './impl.js' },
      },
    });
    writeImplFile(
      pkgDir,
      'impl.js',
      `module.exports.default = async function (tree) {
        tree.write('waived.txt', 'x');
        return { skipAgentic: true };
      };`
    );

    const result = await runNxOrAngularMigration(
      tmpRoot,
      { package: 'pkg-waive', name: 'waive', version: '1.0.0' },
      false
    );

    expect(result.madeChanges).toBe(true);
    expect(result.skipAgentic).toBe(true);
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
    // Angular schematics have no return channel, so they can never waive
    // their AI step.
    expect(result.skipAgentic).toBe(false);
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

  it('reports installed only once an install actually lands', async () => {
    // `installed` re-points the recorded run's dependency baseline
    // (recordInstallLanded), so a value that flips early would let a later
    // step skip an install that never happened.
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, false);
    expect(installer.installed).toBe(false);
    writePackageJson({ dependencies: { foo: '2.0.0' } });
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child);

    const promise = installer.installDepsIfChanged();
    expect(installer.installed).toBe(false);
    child.emit('close', 0);
    await promise;

    expect(installer.installed).toBe(true);
  });

  it('does not report installed when the install fails', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, false);
    writePackageJson({ dependencies: { foo: '2.0.0' } });
    const child = new FakeChildProcess();
    mockSpawn.mockReturnValue(child);

    const promise = installer.installDepsIfChanged();
    child.emit('close', 1);

    await expect(promise).rejects.toThrow();
    expect(installer.installed).toBe(false);
  });

  it('does not report installed when the install was skipped', async () => {
    writePackageJson();
    const installer = new ChangedDepInstaller(tmpRoot, true);
    writePackageJson({ dependencies: { foo: '2.0.0' } });

    await installer.installDepsIfChanged();

    expect(installer.skippedInstall).toBe(true);
    expect(installer.installed).toBe(false);
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

    it('surfaces the configured rerun command in the peer-deps guidance', async () => {
      const errorSpy = jest.spyOn(output, 'error').mockImplementation(() => {});
      try {
        writePackageJson();
        const installer = new ChangedDepInstaller(
          tmpRoot,
          false,
          'nx migrate --run-migration=@nx/js:x'
        );
        writePackageJson({ dependencies: { foo: '2.0.0' } });
        const child = new FakeChildProcess(true);
        mockSpawn.mockReturnValue(child);

        const promise = installer.installDepsIfChanged();
        child.stderr!.emit('data', Buffer.from('npm ERR! code ERESOLVE'));
        child.emit('close', 1);

        await expect(promise).rejects.toMatchObject({
          name: 'NpmPeerDepsInstallError',
        });
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const bodyLines = (
          errorSpy.mock.calls[0][0] as { bodyLines: string[] }
        ).bodyLines.join('\n');
        expect(bodyLines).toContain('   nx migrate --run-migration=@nx/js:x');
        expect(bodyLines).toContain(
          '   nx migrate --run-migration=@nx/js:x --skip-install'
        );
        expect(bodyLines).not.toContain('nx migrate --run-migrations');
      } finally {
        errorSpy.mockRestore();
      }
    });
  });
});

describe('formatSingleMigrationRerunCommand', () => {
  it('passes a plain id through unquoted', () => {
    expect(formatSingleMigrationRerunCommand('@nx/js:my-migration')).toBe(
      'nx migrate --run-migration=@nx/js:my-migration'
    );
  });

  it('single-quotes an id the shell would split or expand, keeping it literal', () => {
    expect(formatSingleMigrationRerunCommand('@nx/js:rename files')).toBe(
      "nx migrate --run-migration='@nx/js:rename files'"
    );
    expect(formatSingleMigrationRerunCommand('@nx/js:use-$(cmd)')).toBe(
      "nx migrate --run-migration='@nx/js:use-$(cmd)'"
    );
    expect(formatSingleMigrationRerunCommand("@nx/js:it's")).toBe(
      String.raw`nx migrate --run-migration='@nx/js:it'\''s'`
    );
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

  describe('skipAgentic', () => {
    let infoSpy: jest.SpyInstance;

    const AGENTIC_ENABLED: ResolvedAgentic = {
      kind: 'enabled',
      selectedAgent: {
        id: 'claude-code',
        displayName: 'Claude Code',
        binary: '/usr/local/bin/claude',
        source: 'path',
      },
    };

    // Writes a migration implementation plus its `migrations.json` entry, so
    // each case can pick its own return value and change footprint.
    const writeMigration = (
      name: string,
      body: string
    ): { package: string; name: string; version: string } => {
      const collectionPath = join(pkgDir, 'migrations.json');
      const collection = JSON.parse(readFileSync(collectionPath, 'utf-8'));
      collection.generators[name] = {
        version: '9.0.0',
        implementation: `./${name}.js`,
      };
      writeFileSync(collectionPath, JSON.stringify(collection));
      writeImplFile(
        pkgDir,
        `${name}.js`,
        `module.exports.default = async function (tree) { ${body} };`
      );
      return { package: 'exec-plugin', name, version: '9.0.0' };
    };

    const hybrid = (name: string, body: string) => ({
      ...writeMigration(name, body),
      implementation: `./${name}.js`,
      prompt: `prompts/${name}.md`,
    });

    const run = (migrations: Array<Record<string, unknown>>) =>
      executeMigrations(
        tmpRoot,
        migrations as Parameters<typeof executeMigrations>[1],
        false,
        /* shouldCreateCommits: */ true,
        'chore(repo): ',
        true,
        AGENTIC_ENABLED,
        false,
        /* shouldRunValidation: */ true
      );

    const logged = () =>
      infoSpy.mock.calls.map((args) => String(args[0] ?? '')).join('\n');

    beforeEach(() => {
      infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => undefined);
      mockCommitMigrationIfRequested.mockResolvedValue({
        status: 'committed',
        sha: 'sha',
      });
      mockRunAgenticPromptStep.mockResolvedValue({
        ambiguous: false,
        summary: 'done',
      });
    });

    afterEach(() => {
      infoSpy.mockRestore();
    });

    it('runs the prompt step for a hybrid that does not waive it', async () => {
      const m = hybrid('hybrid-keeps', `tree.write('kept.txt', 'x');`);

      const result = await run([m]);

      expect(mockRunAgenticPromptStep).toHaveBeenCalledTimes(1);
      expect(result.waivedAgenticStepsCount).toBe(0);
    });

    it('skips the prompt step, the next-steps entry, and the deferral for a waived hybrid', async () => {
      const m = hybrid(
        'hybrid-waives',
        `tree.write('waived.txt', 'x'); return { skipAgentic: true };`
      );

      const result = await run([m]);

      expect(mockRunAgenticPromptStep).not.toHaveBeenCalled();
      expect(result.skippedPrompts).toEqual([]);
      expect(result.skippedPromptsCount).toBe(0);
      expect(result.nextSteps).toEqual([]);
      expect(result.waivedAgenticStepsCount).toBe(1);
      expect(logged()).toContain(
        'Prompt phase skipped. The migration reported nothing left for the AI step to do.'
      );
    });

    it('waives the prompt step with the agentic flow disabled too', async () => {
      const m = hybrid(
        'hybrid-waives-offline',
        `tree.write('waived.txt', 'x'); return { skipAgentic: true };`
      );

      const result = await executeMigrations(
        tmpRoot,
        [m] as Parameters<typeof executeMigrations>[1],
        false,
        true,
        'chore(repo): ',
        true,
        { kind: 'disabled' }
      );

      expect(result.skippedPrompts).toEqual([]);
      expect(result.waivedAgenticStepsCount).toBe(1);
      expect(logged()).toContain(
        'Prompt phase skipped. The migration reported nothing left for the AI step to do.'
      );
    });

    it('does not commit a waived hybrid that made no changes, leaving prior commit debt pending', async () => {
      mockCommitMigrationIfRequested.mockReset();
      mockCommitMigrationIfRequested.mockResolvedValue({
        status: 'failed',
        reason: 'boom',
      });
      const first = migration('mig-a', '1.0.0');
      const waived = hybrid(
        'hybrid-noop-waives',
        `return { skipAgentic: true };`
      );

      const result = await run([first, waived]);

      // Only `mig-a` attempted a commit: a no-op migration must not absorb
      // the prior failed commit's diff under its own name.
      expect(mockCommitMigrationIfRequested).toHaveBeenCalledTimes(1);
      expect(mockCommitMigrationIfRequested.mock.calls[0][1].name).toBe(
        'mig-a'
      );
      expect(result.migrationsWithNoChanges.map((m) => m.name)).toEqual([
        'hybrid-noop-waives',
      ]);
      expect(result.retainedAtSuccess).toEqual(['exec-plugin: mig-a']);
      expect(result.waivedAgenticStepsCount).toBe(1);
    });

    it('skips the validation step for a waived generator-only migration', async () => {
      const m = writeMigration(
        'gen-waives',
        `tree.write('validated.txt', 'x'); return { skipAgentic: true };`
      );

      const result = await run([m]);

      expect(mockRunAgenticPromptStep).not.toHaveBeenCalled();
      expect(result.waivedAgenticStepsCount).toBe(1);
      expect(logged()).toContain(
        'Validation skipped. The migration reported its changes need no AI review.'
      );
    });

    it('stays silent for a waived generator-only migration that had no changes to validate', async () => {
      const m = writeMigration(
        'gen-noop-waives',
        `return { skipAgentic: true };`
      );

      const result = await run([m]);

      expect(mockRunAgenticPromptStep).not.toHaveBeenCalled();
      expect(logged()).not.toContain('Validation skipped');
      // Nothing was going to run, so there is no waived step to report.
      expect(result.waivedAgenticStepsCount).toBe(0);
      expect(result.migrationsWithNoChanges.map((m) => m.name)).toEqual([
        'gen-noop-waives',
      ]);
    });

    // `agenticRun` requires `kind: 'enabled'` and the outer-agent hand-off
    // requires `kind: 'inside-agent'`, so these two pin the asymmetry that
    // falls out of that: a hybrid's prompt is owed in every mode and waiving
    // it moots the hand-off, while a generator-only migration has no
    // validation step to waive under `inside-agent` and keeps the hand-off.
    const runInsideAgent = (m: Record<string, unknown>) =>
      executeMigrations(
        tmpRoot,
        [m] as Parameters<typeof executeMigrations>[1],
        false,
        true,
        'chore(repo): ',
        true,
        { kind: 'inside-agent' },
        false,
        /* shouldRunValidation: */ true
      );

    it('keeps the outer-agent hand-off for a waived generator-only migration under inside-agent', async () => {
      const m = writeMigration(
        'gen-waives-inside-agent',
        `tree.write('validated.txt', 'x'); return { skipAgentic: true, agentContext: ['hint for the outer agent'] };`
      );
      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);
      const verboseSpy = jest
        .spyOn(logger, 'verbose')
        .mockImplementation(() => undefined);

      let written: string;
      // Read before restoring: `mockRestore` also resets the recorded calls, so
      // asserting on the spy afterwards would pass no matter what fired.
      let verboseCalls: number;
      let result: Awaited<ReturnType<typeof executeMigrations>>;
      try {
        result = await runInsideAgent(m);
        written = stdoutSpy.mock.calls.map((args) => String(args[0])).join('');
        verboseCalls = verboseSpy.mock.calls.length;
      } finally {
        stdoutSpy.mockRestore();
        verboseSpy.mockRestore();
      }

      expect(written).toContain(
        '<agent_context migration="exec-plugin:gen-waives-inside-agent">'
      );
      expect(written).toContain('hint for the outer agent');
      // No validation step exists under `inside-agent`, so nothing was waived
      // and neither the user-facing line nor the author-facing note applies.
      expect(result.waivedAgenticStepsCount).toBe(0);
      expect(logged()).not.toContain('Validation skipped');
      expect(verboseCalls).toBe(0);
    });

    it('drops the outer-agent hand-off for a waived hybrid under inside-agent', async () => {
      const m = hybrid(
        'hybrid-waives-inside-agent',
        `tree.write('waived.txt', 'x'); return { skipAgentic: true, agentContext: ['hint for the outer agent'] };`
      );
      const stdoutSpy = jest
        .spyOn(process.stdout, 'write')
        .mockImplementation(() => true);

      let written: string;
      let result: Awaited<ReturnType<typeof executeMigrations>>;
      try {
        result = await runInsideAgent(m);
        written = stdoutSpy.mock.calls.map((args) => String(args[0])).join('');
      } finally {
        stdoutSpy.mockRestore();
      }

      expect(written).not.toContain('<agent_context');
      expect(result.waivedAgenticStepsCount).toBe(1);
      expect(result.skippedPrompts).toEqual([]);
    });

    it('runs the validation step for a generator-only migration that does not waive it', async () => {
      const m = writeMigration(
        'gen-keeps',
        `tree.write('validated.txt', 'x');`
      );

      const result = await run([m]);

      expect(mockRunAgenticPromptStep).toHaveBeenCalledTimes(1);
      expect(result.waivedAgenticStepsCount).toBe(0);
    });
  });
});
