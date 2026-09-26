/** One stored version of a snapshot set: what crosses the socket in place of the handle. */
export interface IoSnapshotVersion {
  commit: string;
  fetchedAt: number;
}
