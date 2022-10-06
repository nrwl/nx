import {
  calculateFileChanges,
  DeletedFileChange,
  WholeFileChange,
} from './file-utils';
import { JsonDiffType } from '../utils/json-diff';
import { defaultFileHasher } from '../hasher/file-hasher';
import ignore from 'ignore';
import { join, relative } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import * as ingoreUtils from '../utils/ignore-patterns';

describe('calculateFileChanges', () => {
  beforeEach(async () => {
    await defaultFileHasher.ensureInitialized();
  });

  it('should return a whole file change by default for files that exist', () => {
    const changes = calculateFileChanges(
      [relative(workspaceRoot, __filename)], // this **must** be a real file in the Nx repo
      [],
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
      [],
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
    const changes = calculateFileChanges(
      [relative(workspaceRoot, join(__dirname, 'i-dont-exist.json'))],
      [],
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
});
