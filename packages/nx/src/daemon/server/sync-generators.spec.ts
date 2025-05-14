import type { SyncGeneratorRunResult } from '../../utils/sync-generators';
import { _getConflictingGeneratorGroups } from './sync-generators';

describe('_getConflictingGeneratorGroups', () => {
  it('should return grouped conflicting generators', () => {
    const results: SyncGeneratorRunResult[] = [
      {
        generatorName: 'a',
        changes: [
          { type: 'UPDATE', path: 'file1.txt', content: Buffer.from('') },
          { type: 'UPDATE', path: 'file2.txt', content: Buffer.from('') },
          { type: 'UPDATE', path: 'file3.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'b',
        changes: [
          { type: 'UPDATE', path: 'file1.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'c',
        changes: [
          { type: 'UPDATE', path: 'file3.txt', content: Buffer.from('') },
          { type: 'UPDATE', path: 'file4.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'd',
        changes: [
          { type: 'UPDATE', path: 'file5.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'e',
        changes: [
          { type: 'UPDATE', path: 'file4.txt', content: Buffer.from('') },
          { type: 'UPDATE', path: 'file6.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'f',
        changes: [
          { type: 'UPDATE', path: 'file7.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'g',
        changes: [
          { type: 'UPDATE', path: 'file7.txt', content: Buffer.from('') },
        ],
      },
      {
        generatorName: 'h',
        changes: [
          { type: 'UPDATE', path: 'file8.txt', content: Buffer.from('') },
        ],
      },
    ];

    expect(_getConflictingGeneratorGroups(results)).toStrictEqual([
      ['a', 'b', 'c', 'e'],
      ['f', 'g'],
    ]);
  });
});
