import type { ChangeBatch, FileData } from '../../../native';

export interface AcceptedChanges {
  createdFiles: FileData[];
  updatedFiles: FileData[];
  deletedFiles: string[];
}

/**
 * The latest state the daemon has taken in for each path, by the workspace
 * context's change `seq`. One change can reach the daemon twice, from the
 * subscription and from the `settle` that follows, in either order; a path is
 * taken in only when its batch is not older than what was taken for it and
 * says something different.
 */
export class AppliedChangeLedger {
  private readonly taken = new Map<
    string,
    { seq: number; hash: string | null }
  >();

  accept(batch: ChangeBatch): AcceptedChanges {
    return {
      createdFiles: batch.createdFiles.filter((f) =>
        this.take(f.file, f.hash, batch.seq)
      ),
      updatedFiles: batch.updatedFiles.filter((f) =>
        this.take(f.file, f.hash, batch.seq)
      ),
      deletedFiles: batch.deletedFiles.filter((file) =>
        this.take(file, null, batch.seq)
      ),
    };
  }

  /** The context's sequence starts over when the context is re-created. */
  clear() {
    this.taken.clear();
  }

  private take(file: string, hash: string | null, seq: number): boolean {
    const previous = this.taken.get(file);
    if (previous && (previous.seq > seq || previous.hash === hash)) {
      return false;
    }
    this.taken.set(file, { seq, hash });
    return true;
  }
}
