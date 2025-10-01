import {
  calculateFileChanges,
  DeletedFileChange,
  WholeFileChange,
} from './file-utils';
import * as fs from 'fs';
import { JsonDiffType } from '../utils/json-diff';
import ignore = require('ignore');

describe('calculateFileChanges', () => {
  it('should return a whole file change by default for files that exist', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    const changes = calculateFileChanges(
      ['proj/index.ts'],
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
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const changes = calculateFileChanges(
      ['i-dont-exist.json'],
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

  it('should ignore *.md changes', () => {
    const ig = ignore();
    ig.add('*.md');
    const changes = calculateFileChanges(
      ['proj/readme.md'],
      [],
      undefined,
      (path, revision) => {
        return revision === 'sha1' ? '' : 'const a = 0;';
      },
      ig
    );
    expect(changes.length).toEqual(0);
  });
});
