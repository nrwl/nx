import type { MockInstance } from 'vitest';
const mockRunNxOrAngularMigration = vi.fn();
const mockInstallDepsIfChanged = vi.fn();
const mockCommitMigrationIfRequested = vi.fn();

// The script under test is a plain CJS .js file; load it and mock its
// dependencies entirely in the require channel so the test does not depend
// on how vite routes requires inside transformed CJS.
import { mockCjsModule } from '../../internal-testing-utils/cjs-mock';
mockCjsModule(import.meta.url, './migrate', {
  runNxOrAngularMigration: (...args: unknown[]) =>
    mockRunNxOrAngularMigration(...args),
  ChangedDepInstaller: class {
    installDepsIfChanged = mockInstallDepsIfChanged;
  },
});
mockCjsModule(import.meta.url, './migrate-commits', {
  commitMigrationIfRequested: (...args: unknown[]) =>
    mockCommitMigrationIfRequested(...args),
});
mockCjsModule(import.meta.url, 'child_process', {
  ...require('child_process'),
  execSync: () => 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2\n',
});
import { createRequire } from 'node:module';
const cjsRequire = createRequire(import.meta.url);

// The single-migration child that Nx Console spawns hand-builds its JSON
// payload, so a unit test on the parent's record writer stays green even when
// the child never serializes a field. These execute the real script against a
// mocked `runNxOrAngularMigration` and assert the payload it writes.
describe('run-migration-process', () => {
  let written: string[];
  let argvBackup: string[];
  let writeSpy: MockInstance;
  let exitSpy: MockInstance;

  beforeEach(() => {
    written = [];
    argvBackup = process.argv;
    process.argv = [
      'node',
      'run-migration-process.js',
      '/workspace',
      'pkg#mig',
      'pkg',
      'mig',
      '1.0.0',
      'false',
      'chore: ',
    ];
    writeSpy = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      });
    exitSpy = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never);
    mockInstallDepsIfChanged.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.argv = argvBackup;
    writeSpy.mockRestore();
    exitSpy.mockRestore();
    vi.resetModules();
    vi.clearAllMocks();
  });

  const runScript = async (): Promise<Record<string, unknown>> => {
    delete cjsRequire.cache[cjsRequire.resolve('./run-migration-process.js')];
    cjsRequire('./run-migration-process.js');
    // The script's top-level call is fire-and-forget; let its awaits settle.
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return JSON.parse(written.join(''));
  };

  it('forwards skipAgentic from the migration return value to the success payload', async () => {
    mockRunNxOrAngularMigration.mockResolvedValue({
      changes: [{ path: 'a.ts', type: 'UPDATE', content: Buffer.from('x') }],
      nextSteps: ['do a thing'],
      skipAgentic: true,
      logs: '',
      madeChanges: true,
    });

    const payload = await runScript();

    expect(payload.type).toBe('success');
    expect(payload.skipAgentic).toBe(true);
    expect(payload.nextSteps).toEqual(['do a thing']);
    expect(payload.fileChanges).toEqual([{ path: 'a.ts', type: 'UPDATE' }]);
  });

  it('reports skipAgentic: false for a migration that did not waive its AI step', async () => {
    mockRunNxOrAngularMigration.mockResolvedValue({
      changes: [],
      nextSteps: [],
      skipAgentic: false,
      logs: '',
      madeChanges: false,
    });

    const payload = await runScript();

    expect(payload.skipAgentic).toBe(false);
  });

  it('commits through migrate-commits instead of installing directly when create-commits is on', async () => {
    process.argv[7] = 'true';
    mockCommitMigrationIfRequested.mockResolvedValue({
      status: 'committed',
      sha: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    });
    mockRunNxOrAngularMigration.mockResolvedValue({
      changes: [{ path: 'a.ts', type: 'UPDATE', content: Buffer.from('x') }],
      nextSteps: [],
      skipAgentic: true,
      logs: '',
      madeChanges: true,
    });

    const payload = await runScript();

    expect(payload.type).toBe('success');
    expect(mockCommitMigrationIfRequested).toHaveBeenCalledTimes(1);
    // The commit helper owns the install here, so it has to receive the
    // callback and the create-commits-off path's direct call must not fire.
    expect(mockCommitMigrationIfRequested).toHaveBeenCalledWith(
      '/workspace',
      expect.objectContaining({ package: 'pkg', name: 'mig' }),
      true,
      'chore: ',
      expect.any(Function)
    );
    expect(mockInstallDepsIfChanged).not.toHaveBeenCalled();
  });
});
