import type { Mock } from 'vitest';
vi.mock('child_process');
vi.mock('fs');
import { execFileSync, execSync, spawn } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import type { MigrationDetailsWithId } from '../../config/misc-interfaces';
import {
  acknowledgeMigrationPrompt,
  finishMigrationProcess,
  runSingleMigration,
  undoMigration,
  type MigrationsJsonMetadata,
} from './migrate-ui-api';

const SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
// `git reset --hard ${ref}^` appends a caret, so a payload needs a trailing
// `#` to comment it out.
const PAYLOAD = 'HEAD; touch /tmp/nx-migrate-pwned #';

describe('migrate-ui-api git invocations', () => {
  const execSyncMock = execSync as Mock;
  const execFileSyncMock = execFileSync as Mock;

  beforeEach(() => {
    execSyncMock.mockReturnValue('');
    execFileSyncMock.mockReturnValue('');
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('undoMigration', () => {
    function metadataWithRef(ref: string): MigrationsJsonMetadata {
      return {
        completedMigrations: {
          'some-migration': {
            type: 'successful',
            name: 'some-migration',
            changedFiles: [{ path: 'a.ts', type: 'UPDATE' } as any],
            ref,
          },
        },
      };
    }

    it('should pass the ref to git as an argument rather than through a shell', () => {
      undoMigration('/workspace', 'some-migration')(metadataWithRef(SHA));

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['reset', '--hard', `${SHA}^`],
        expect.objectContaining({ cwd: '/workspace' })
      );
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('should reject a ref from migrations.json that is not a commit sha', () => {
      expect(() =>
        undoMigration('/workspace', 'some-migration')(metadataWithRef(PAYLOAD))
      ).toThrow(/Invalid git commit sha/);

      expect(execFileSyncMock).not.toHaveBeenCalled();
      expect(execSyncMock).not.toHaveBeenCalled();
    });

    it('should not invoke git when the migration changed no files', () => {
      const metadata = metadataWithRef(SHA);
      (metadata.completedMigrations['some-migration'] as any).changedFiles = [];

      undoMigration('/workspace', 'some-migration')(metadata);

      expect(execFileSyncMock).not.toHaveBeenCalled();
    });
  });

  describe('finishMigrationProcess', () => {
    function mockMigrationsJson(initialGitRef?: { ref: string }) {
      (existsSync as Mock).mockReturnValue(false);
      (readFileSync as Mock).mockReturnValue(
        JSON.stringify({
          'nx-console': initialGitRef ? { initialGitRef } : {},
        })
      );
    }

    it('should pass the commit message over stdin rather than interpolating it', () => {
      mockMigrationsJson();

      finishMigrationProcess(
        '/workspace',
        false,
        'chore: bump "foo" to $LATEST'
      );

      expect(execSyncMock).toHaveBeenCalledWith(
        'git commit --no-verify -F -',
        expect.objectContaining({ input: 'chore: bump "foo" to $LATEST' })
      );
      expect(execSyncMock).not.toHaveBeenCalledWith(
        expect.stringContaining('bump "foo"'),
        expect.anything()
      );
    });

    it('should pass the squash ref to git as an argument rather than through a shell', () => {
      mockMigrationsJson({ ref: SHA });

      finishMigrationProcess('/workspace', true, 'chore: migrate');

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['reset', '--soft', SHA],
        expect.objectContaining({ cwd: '/workspace' })
      );
    });

    it('should reject an initialGitRef from migrations.json that is not a commit sha', () => {
      mockMigrationsJson({ ref: PAYLOAD });

      expect(() =>
        finishMigrationProcess('/workspace', true, 'chore: migrate')
      ).toThrow(/Invalid git commit sha/);

      expect(execFileSyncMock).not.toHaveBeenCalled();
      expect(execSyncMock).not.toHaveBeenCalledWith(
        expect.stringContaining('touch /tmp/nx-migrate-pwned'),
        expect.anything()
      );
    });
  });

  describe('runSingleMigration', () => {
    const spawnMock = spawn as Mock;
    let migrationsJson: Record<string, any>;

    class FakeChild extends EventEmitter {
      stdout = new EventEmitter();
      stderr = new EventEmitter();
    }

    const hybrid: MigrationDetailsWithId = {
      id: 'pkg#hybrid',
      package: 'pkg',
      name: 'hybrid',
      version: '1.0.0',
      description: 'a hybrid migration',
      implementation: './hybrid.js',
      prompt: 'prompts/hybrid.md',
    };
    const generatorOnly: MigrationDetailsWithId = {
      id: 'pkg#gen',
      package: 'pkg',
      name: 'gen',
      version: '1.0.0',
      description: 'a generator-only migration',
      implementation: './gen.js',
    };

    beforeEach(() => {
      migrationsJson = { 'nx-console': {} };
      (readFileSync as Mock).mockImplementation(() =>
        JSON.stringify(migrationsJson)
      );
      (writeFileSync as Mock).mockImplementation(
        (_path: string, content: string) => {
          migrationsJson = JSON.parse(content);
        }
      );
      // Same ref before and after so the metadata-amend branch stays out of it.
      execSyncMock.mockReturnValue(`${SHA}\n`);
    });

    // Drives the child process the way the real one behaves: one JSON line on
    // stdout, then a clean exit.
    async function run(
      migration: MigrationDetailsWithId,
      payload: Record<string, unknown>
    ) {
      const child = new FakeChild();
      spawnMock.mockReturnValue(child);
      const done = runSingleMigration('/workspace', migration, {
        createCommits: false,
      });
      child.stdout.emit(
        'data',
        JSON.stringify({
          type: 'success',
          fileChanges: [{ path: 'a.ts', type: 'UPDATE' }],
          gitRefAfter: SHA,
          nextSteps: [],
          ...payload,
        })
      );
      child.emit('close', 0);
      await done;
      return migrationsJson['nx-console'].completedMigrations[migration.id];
    }

    it('marks a waived hybrid as acknowledged so the UI does not wait on a prompt nobody owes', async () => {
      const record = await run(hybrid, { skipAgentic: true });

      expect(record.acknowledgedPrompt).toBe(true);
      expect(record.skipAgentic).toBe(true);
    });

    it('leaves a hybrid that did not waive its prompt unacknowledged', async () => {
      const record = await run(hybrid, { skipAgentic: false });

      expect(record.acknowledgedPrompt).toBeUndefined();
      expect(record.skipAgentic).toBeUndefined();
    });

    it('records nothing extra for a generator-only migration that waived its validation', async () => {
      const record = await run(generatorOnly, { skipAgentic: true });

      expect(record.acknowledgedPrompt).toBeUndefined();
      expect(record.skipAgentic).toBeUndefined();
    });

    it('drops the acknowledgement it set itself when a rerun no longer waives the prompt', async () => {
      await run(hybrid, { skipAgentic: true });

      const record = await run(hybrid, { skipAgentic: false });

      expect(record.acknowledgedPrompt).toBeUndefined();
      expect(record.skipAgentic).toBeUndefined();
    });

    it('keeps an acknowledgement the user made across a rerun that never waived', async () => {
      await run(hybrid, { skipAgentic: false });
      acknowledgeMigrationPrompt('/workspace', hybrid);

      const record = await run(hybrid, { skipAgentic: false });

      expect(record.acknowledgedPrompt).toBe(true);
    });

    // A waiving run rewrites the whole record, so the ack it leaves behind is
    // indistinguishable from one the user made, and both orderings below re-ask
    // rather than trust it. Only the second pins the guard; the first records
    // the other ordering that loses a user ack the same way.
    it('drops an acknowledgement the user made before a waiving rerun', async () => {
      await run(hybrid, { skipAgentic: false });
      acknowledgeMigrationPrompt('/workspace', hybrid);
      await run(hybrid, { skipAgentic: true });

      const record = await run(hybrid, { skipAgentic: false });

      expect(record.acknowledgedPrompt).toBeUndefined();
    });

    it('drops an acknowledgement the user made on an already waived record', async () => {
      await run(hybrid, { skipAgentic: true });
      acknowledgeMigrationPrompt('/workspace', hybrid);

      const record = await run(hybrid, { skipAgentic: false });

      expect(record.acknowledgedPrompt).toBeUndefined();
    });
  });
});
