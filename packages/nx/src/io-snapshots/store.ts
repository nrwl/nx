import { IoSnapshotStore } from '../native';
import { getDbConnection } from '../utils/db-connection';

/** The snapshot store in this process's workspace database. */
export function getIoSnapshotStore(): IoSnapshotStore {
  return new IoSnapshotStore(getDbConnection());
}
