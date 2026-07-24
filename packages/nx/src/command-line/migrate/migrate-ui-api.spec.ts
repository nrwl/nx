jest.mock('child_process');
jest.mock('fs');
import { execFileSync, execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import {
  finishMigrationProcess,
  undoMigration,
  type MigrationsJsonMetadata,
} from './migrate-ui-api';

const SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
// `git reset --hard ${ref}^` appends a caret, so a payload needs a trailing
// `#` to comment it out.
const PAYLOAD = 'HEAD; touch /tmp/nx-migrate-pwned #';

describe('migrate-ui-api git invocations', () => {
  const execSyncMock = execSync as jest.Mock;
  const execFileSyncMock = execFileSync as jest.Mock;

  beforeEach(() => {
    execSyncMock.mockReturnValue('');
    execFileSyncMock.mockReturnValue('');
  });

  afterEach(() => {
    jest.resetAllMocks();
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
      (existsSync as jest.Mock).mockReturnValue(false);
      (readFileSync as jest.Mock).mockReturnValue(
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
});
