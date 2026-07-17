jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest
      .fn()
      .mockImplementation((...args) => actual.existsSync(...args)),
  };
});
jest.mock('child_process');
import {
  calculateFileChanges,
  DeletedFileChange,
  WholeFileChange,
} from './file-utils';
import { execFileSync, execSync } from 'child_process';
import * as fs from 'fs';
import { JsonDiffType } from '../utils/json-diff';
import { workspaceRoot } from '../utils/workspace-root';
import ignore = require('ignore');

describe('calculateFileChanges', () => {
  it('should return a whole file change by default for files that exist', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const changes = calculateFileChanges(
      ['proj/index.ts'],
      undefined,
      (path, revision) => {
        return revision === 'sha1' ? '' : 'const a = 0;';
      }
    );

    expect(changes[0].getChanges()).toEqual([new WholeFileChange()]);
  });

  it('should return a json changes for json files', () => {
    const changes = calculateFileChanges(
      ['package.json'],
      {
        base: 'sha1',
        head: 'sha2',
      },
      (path, revision) => {
        return revision === 'sha1'
          ? JSON.stringify({
              dependencies: {
                'happy-nrwl': '0.0.1',
                'not-awesome-nrwl': '0.0.1',
              },
            })
          : JSON.stringify({
              dependencies: {
                'happy-nrwl': '0.0.2',
                'awesome-nrwl': '0.0.1',
              },
            });
      }
    );

    expect(changes[0].getChanges()).toContainEqual({
      type: JsonDiffType.Modified,
      path: ['dependencies', 'happy-nrwl'],
      value: {
        lhs: '0.0.1',
        rhs: '0.0.2',
      },
    });
    expect(changes[0].getChanges()).toContainEqual({
      type: JsonDiffType.Deleted,
      path: ['dependencies', 'not-awesome-nrwl'],
      value: {
        lhs: '0.0.1',
        rhs: undefined,
      },
    });
    expect(changes[0].getChanges()).toContainEqual({
      type: JsonDiffType.Added,
      path: ['dependencies', 'awesome-nrwl'],
      value: {
        lhs: undefined,
        rhs: '0.0.1',
      },
    });
  });

  it('should pick up deleted changes for deleted files', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const changes = calculateFileChanges(
      ['i-dont-exist.json'],
      {
        base: 'sha1',
        head: 'sha2',
      },
      (path, revision) => {
        return '';
      }
    );

    expect(changes[0].getChanges()).toEqual([new DeletedFileChange()]);
  });

  it('should ignore *.md changes', () => {
    const ig = ignore();
    ig.add('*.md');
    const changes = calculateFileChanges(
      ['proj/readme.md'],
      undefined,
      (path, revision) => {
        return revision === 'sha1' ? '' : 'const a = 0;';
      },
      ig
    );
    expect(changes.length).toEqual(0);
  });

  describe('reading a file at a revision', () => {
    const execSyncMock = execSync as jest.Mock;
    const execFileSyncMock = execFileSync as jest.Mock;

    beforeEach(() => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      // `git rev-parse --show-toplevel`, used to make the path repo-relative
      execSyncMock.mockReturnValue(Buffer.from(`${workspaceRoot}\n`));
      execFileSyncMock.mockReturnValue(Buffer.from('{}'));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    function readProjJsonAtBase(base: string) {
      const changes = calculateFileChanges(['proj/tsconfig.json'], {
        base,
        head: 'HEAD',
      } as any);
      changes[0].getChanges();
    }

    it('should pass the revision to git as an argument rather than through a shell', () => {
      readProjJsonAtBase('main');

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['show', 'main:proj/tsconfig.json'],
        expect.anything()
      );
    });

    it('should treat a shell substitution in the revision as an opaque revision', () => {
      readProjJsonAtBase('$(touch /tmp/nx-pwned)');

      expect(execFileSyncMock).toHaveBeenCalledWith(
        'git',
        ['show', '$(touch /tmp/nx-pwned):proj/tsconfig.json'],
        expect.anything()
      );
      expect(execSyncMock).not.toHaveBeenCalledWith(
        expect.stringContaining('touch /tmp/nx-pwned'),
        expect.anything()
      );
    });

    it('should not invoke git for an option-like revision', () => {
      readProjJsonAtBase('--upload-pack=id');

      expect(execFileSyncMock).not.toHaveBeenCalled();
      expect(execSyncMock).not.toHaveBeenCalledWith(
        expect.stringContaining('--upload-pack=id'),
        expect.anything()
      );
    });
  });
});
