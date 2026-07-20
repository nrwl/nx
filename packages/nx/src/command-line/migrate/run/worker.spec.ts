const mockRunMigration = jest.fn();
const mockReadMigrationCollection = jest.fn();
const mockLogSkippedInstall = jest.fn();
let mockSkippedInstall = false;
jest.mock('../execute-migration', () => ({
  ChangedDepInstaller: jest.fn().mockImplementation(() => ({
    installDepsIfChanged: jest.fn().mockResolvedValue(undefined),
    get skippedInstall() {
      return mockSkippedInstall;
    },
  })),
  logSkippedPostMigrationInstall: (...args: unknown[]) =>
    mockLogSkippedInstall(...args),
  runNxOrAngularMigration: (...args: unknown[]) => mockRunMigration(...args),
  readMigrationCollection: (...args: unknown[]) =>
    mockReadMigrationCollection(...args),
}));

const mockCommit = jest.fn();
const mockCheckpoint = jest.fn();
jest.mock('../migrate-commits', () => ({
  commitMigrationIfRequested: (...args: unknown[]) => mockCommit(...args),
  commitCheckpointBeforeMigrations: (...args: unknown[]) =>
    mockCheckpoint(...args),
}));

const mockIsInsideAgent = jest.fn();
jest.mock('../agentic/inception', () => ({
  isInsideAgent: () => mockIsInsideAgent(),
}));

jest.mock('../../../utils/package-manager', () => ({
  detectPackageManager: () => 'npm',
  getPackageManagerCommand: () => ({ exec: 'npx' }),
}));

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { output } from '../../../utils/output';
import { runSingleMigrationWorker } from './worker';

interface PlannedMigration {
  package: string;
  name: string;
  version: string;
  implementation?: string;
  prompt?: string;
}

const genMig = (pkg: string, name: string): PlannedMigration => ({
  package: pkg,
  name,
  version: '1.0.0',
  implementation: './impl.js',
});
const promptMig = (pkg: string, name: string): PlannedMigration => ({
  package: pkg,
  name,
  version: '1.0.0',
  prompt: `prompts/${name}.md`,
});
const hybridMig = (pkg: string, name: string): PlannedMigration => ({
  package: pkg,
  name,
  version: '1.0.0',
  implementation: './impl.js',
  prompt: `prompts/${name}.md`,
});

const changeList = () => [
  { type: 'UPDATE' as const, path: 'a.ts', content: Buffer.from('x') },
];

describe('runSingleMigrationWorker', () => {
  let root: string;
  let stdout: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-migrate-worker-'));
    stdout = '';
    jest.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: unknown
    ) => {
      stdout += String(chunk);
      return true;
    }) as unknown as typeof process.stdout.write);
    jest.spyOn(output, 'log').mockImplementation(() => {});
    jest.spyOn(output, 'warn').mockImplementation(() => {});

    mockRunMigration.mockReset().mockResolvedValue({
      changes: [],
      nextSteps: [],
      agentContext: [],
      logs: '',
      madeChanges: false,
    });
    mockReadMigrationCollection.mockReset().mockImplementation(() => {
      throw new Error('not mocked');
    });
    mockCommit.mockReset().mockResolvedValue({ status: 'no-changes' });
    mockCheckpoint.mockReset();
    mockIsInsideAgent.mockReset().mockReturnValue(false);
    mockLogSkippedInstall.mockReset();
    mockSkippedInstall = false;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  function writeMigrations(migrations: PlannedMigration[]): void {
    writeFileSync(
      join(root, 'migrations.json'),
      JSON.stringify({ migrations })
    );
  }

  function standaloneInput(overrides: {
    runMigration: string;
    createCommits?: boolean;
  }) {
    return {
      root,
      options: { runMigration: overrides.runMigration },
      createCommits: overrides.createCommits,
      commitPrefix: 'chore: [nx migration] ',
      skipInstall: true,
      isVerbose: false,
    };
  }

  describe('id resolution', () => {
    it('resolves an exact <package>:<name> id', async () => {
      writeMigrations([genMig('@nx/js', 'a'), genMig('@nx/react', 'b')]);

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/react:b' })
      );

      expect(mockRunMigration).toHaveBeenCalledTimes(1);
      expect(mockRunMigration.mock.calls[0][1]).toMatchObject({
        package: '@nx/react',
        name: 'b',
      });
    });

    it('resolves a bare name when exactly one migration matches', async () => {
      writeMigrations([genMig('@nx/js', 'a'), genMig('@nx/react', 'b')]);

      await runSingleMigrationWorker(standaloneInput({ runMigration: 'b' }));

      expect(mockRunMigration.mock.calls[0][1]).toMatchObject({
        package: '@nx/react',
        name: 'b',
      });
    });

    it('errors on a bare name matching multiple migrations, listing the matches', async () => {
      writeMigrations([genMig('@nx/js', 'dup'), genMig('@nx/react', 'dup')]);

      await expect(
        runSingleMigrationWorker(standaloneInput({ runMigration: 'dup' }))
      ).rejects.toThrow(/@nx\/js:dup[\s\S]*@nx\/react:dup/);
      expect(mockRunMigration).not.toHaveBeenCalled();
    });

    it('errors on an unknown id, naming the id and the source', async () => {
      writeMigrations([genMig('@nx/js', 'a')]);

      await expect(
        runSingleMigrationWorker(standaloneInput({ runMigration: 'nope' }))
      ).rejects.toThrow(
        /No migration matching 'nope' was found in migrations\.json/
      );
    });

    it('errors when migrations.json is missing', async () => {
      await expect(
        runSingleMigrationWorker(standaloneInput({ runMigration: 'x' }))
      ).rejects.toThrow(/File 'migrations\.json' doesn't exist/);
    });
  });

  describe('standalone execution', () => {
    it('runs a generator migration and prints its next steps', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: ['do a thing'],
        agentContext: [],
        logs: '',
        madeChanges: true,
      });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(mockRunMigration).toHaveBeenCalledTimes(1);
      expect(output.log).toHaveBeenCalledWith(
        expect.objectContaining({ bodyLines: ['- do a thing'] })
      );
    });

    it('commits a generator migration only when create-commits is enabled', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: [],
        logs: '',
        madeChanges: true,
      });
      mockCommit.mockResolvedValue({ status: 'committed', sha: 'abc' });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen', createCommits: false })
      );
      expect(mockCommit).not.toHaveBeenCalled();

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen', createCommits: true })
      );
      expect(mockCommit).toHaveBeenCalledTimes(1);
    });

    it('checkpoints pre-existing working-tree state before the migration when commits are enabled', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockCommit.mockResolvedValue({ status: 'committed', sha: 'abc' });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen', createCommits: true })
      );

      expect(mockCheckpoint).toHaveBeenCalledWith(
        root,
        'chore: [nx migration] '
      );
      expect(mockCheckpoint.mock.invocationCallOrder[0]).toBeLessThan(
        mockRunMigration.mock.invocationCallOrder[0]
      );
    });

    it('does not checkpoint when commits are not enabled', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(mockCheckpoint).not.toHaveBeenCalled();
    });

    it('forwards a generator-only migration agentContext to the outer agent', async () => {
      mockIsInsideAgent.mockReturnValue(true);
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: ['hint one'],
        logs: '',
        madeChanges: true,
      });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(stdout).toContain('<agent_context migration="@nx/js:gen">');
      expect(stdout).toContain('hint one');
    });

    it('does not forward agentContext outside an agent', async () => {
      mockIsInsideAgent.mockReturnValue(false);
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: ['hint one'],
        logs: '',
        madeChanges: true,
      });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(stdout).not.toContain('<agent_context');
    });

    it('treats a failed commit as a warning, not a failure', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: [],
        logs: '',
        madeChanges: true,
      });
      mockCommit.mockResolvedValue({ status: 'failed', reason: 'boom' });

      await expect(
        runSingleMigrationWorker(
          standaloneInput({ runMigration: '@nx/js:gen', createCommits: true })
        )
      ).resolves.toBeUndefined();
    });

    it('emits a tagged prompt block for a prompt-only migration inside an agent', async () => {
      mockIsInsideAgent.mockReturnValue(true);
      writeMigrations([promptMig('@nx/js', 'p')]);

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:p' })
      );

      expect(mockRunMigration).not.toHaveBeenCalled();
      expect(stdout).toContain('<nx_migrate_prompt migration="@nx/js:p">');
      expect(stdout).toContain('"migrationId": "@nx/js:p"');
      expect(stdout).toContain('"prompt": "prompts/p.md"');
    });

    it('prints prompt instructions for a prompt-only migration outside an agent', async () => {
      mockIsInsideAgent.mockReturnValue(false);
      writeMigrations([promptMig('@nx/js', 'p')]);

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:p' })
      );

      expect(mockRunMigration).not.toHaveBeenCalled();
      expect(stdout).not.toContain('<nx_migrate_prompt');
      expect(output.log).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('must be applied manually'),
        })
      );
    });

    it('runs the generator half then emits the prompt block for a hybrid migration inside an agent', async () => {
      mockIsInsideAgent.mockReturnValue(true);
      writeMigrations([hybridMig('@nx/js', 'h')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: ['generator hint'],
        logs: 'generator ran',
        madeChanges: true,
      });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:h' })
      );

      expect(mockRunMigration).toHaveBeenCalledTimes(1);
      expect(stdout).toContain('<nx_migrate_prompt migration="@nx/js:h">');
      expect(stdout).toContain('"impl"');
      // Hybrid agentContext rides inside the payload, not a separate block.
      expect(stdout).toContain('"agentContext"');
      expect(stdout).toContain('"generator hint"');
      expect(stdout).not.toContain('<agent_context');
    });

    it('does not commit when the generator makes no changes, even with -C', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      // Default mockRunMigration returns madeChanges: false.

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen', createCommits: true })
      );

      expect(mockRunMigration).toHaveBeenCalledTimes(1);
      expect(mockCommit).not.toHaveBeenCalled();
    });

    it('warns when a dependency-changing migration ran with the install skipped', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: [],
        logs: '',
        madeChanges: true,
      });
      mockSkippedInstall = true;

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(mockLogSkippedInstall).toHaveBeenCalledWith(root);
    });

    it('does not warn about a skipped install when nothing was skipped', async () => {
      writeMigrations([genMig('@nx/js', 'gen')]);
      mockRunMigration.mockResolvedValue({
        changes: changeList(),
        nextSteps: [],
        agentContext: [],
        logs: '',
        madeChanges: true,
      });

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:gen' })
      );

      expect(mockLogSkippedInstall).not.toHaveBeenCalled();
    });

    it('prints the prompt file contents when it is readable', async () => {
      writeMigrations([promptMig('@nx/js', 'p')]);
      mkdirSync(join(root, 'prompts'), { recursive: true });
      writeFileSync(join(root, 'prompts', 'p.md'), 'step one\nstep two');

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:p' })
      );

      expect(output.log).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            'step one',
            'step two',
            'Review the instructions above and apply them manually.',
          ]),
        })
      );
    });

    it('warns naming the prompt file and error code when it cannot be read', async () => {
      // promptMig points at prompts/p.md, which is never created here.
      writeMigrations([promptMig('@nx/js', 'p')]);

      await runSingleMigrationWorker(
        standaloneInput({ runMigration: '@nx/js:p' })
      );

      expect(output.log).toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            expect.stringMatching(
              /The instructions file 'prompts\/p\.md' could not be read \(ENOENT\)/
            ),
          ]),
        })
      );
      expect(output.log).not.toHaveBeenCalledWith(
        expect.objectContaining({
          bodyLines: expect.arrayContaining([
            'Review the instructions above and apply them manually.',
          ]),
        })
      );
    });
  });
});
