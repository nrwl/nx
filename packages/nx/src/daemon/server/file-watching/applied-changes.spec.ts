import type { ChangeBatch } from '../../../native';
import { AppliedChangeLedger } from './applied-changes';

function batch(
  seq: number,
  changes: Partial<Omit<ChangeBatch, 'seq'>>
): ChangeBatch {
  return {
    seq,
    createdFiles: [],
    updatedFiles: [],
    deletedFiles: [],
    ...changes,
  };
}

describe('AppliedChangeLedger', () => {
  it('drops an older batch that arrives after a newer one', () => {
    const ledger = new AppliedChangeLedger();
    ledger.accept(
      batch(2, { updatedFiles: [{ file: 'a.ts', hash: 'second' }] })
    );

    const late = ledger.accept(
      batch(1, { updatedFiles: [{ file: 'a.ts', hash: 'first' }] })
    );

    expect(late.updatedFiles).toEqual([]);
  });

  it('does not resurrect a deleted file from an older batch', () => {
    const ledger = new AppliedChangeLedger();
    ledger.accept(batch(3, { deletedFiles: ['a.ts'] }));

    const late = ledger.accept(
      batch(2, { createdFiles: [{ file: 'a.ts', hash: 'h' }] })
    );

    expect(late.createdFiles).toEqual([]);
  });

  it('takes in a repeat of the same state once', () => {
    const ledger = new AppliedChangeLedger();
    const heard = ledger.accept(
      batch(1, { updatedFiles: [{ file: 'a.ts', hash: 'h' }] })
    );
    // settle hands back everything since the last settle, under its newest seq.
    const settled = ledger.accept(
      batch(4, {
        updatedFiles: [
          { file: 'a.ts', hash: 'h' },
          { file: 'b.ts', hash: 'b' },
        ],
      })
    );

    expect(heard.updatedFiles.map((f) => f.file)).toEqual(['a.ts']);
    expect(settled.updatedFiles.map((f) => f.file)).toEqual(['b.ts']);
  });

  it('takes in a file that returns to an earlier content', () => {
    const ledger = new AppliedChangeLedger();
    ledger.accept(batch(1, { updatedFiles: [{ file: 'a.ts', hash: 'x' }] }));
    ledger.accept(batch(2, { updatedFiles: [{ file: 'a.ts', hash: 'y' }] }));

    const back = ledger.accept(
      batch(3, { updatedFiles: [{ file: 'a.ts', hash: 'x' }] })
    );

    expect(back.updatedFiles).toEqual([{ file: 'a.ts', hash: 'x' }]);
  });

  it('starts over when cleared', () => {
    const ledger = new AppliedChangeLedger();
    ledger.accept(batch(9, { updatedFiles: [{ file: 'a.ts', hash: 'old' }] }));
    ledger.clear();

    const fresh = ledger.accept(
      batch(1, { updatedFiles: [{ file: 'a.ts', hash: 'new' }] })
    );

    expect(fresh.updatedFiles).toEqual([{ file: 'a.ts', hash: 'new' }]);
  });
});
