import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

/**
 * `ioSnapshotBundleDir` is the fetched I/O snapshot bundle for this run's
 * HEAD (see `fetchIoSnapshotsForRun`); undefined hashes natively.
 */
export function createTaskHasher(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  runnerOptions?: any,
  ioSnapshotBundleDir?: string
): TaskHasher {
  const ioSnapshots = ioSnapshotBundleDir
    ? { bundleDir: ioSnapshotBundleDir }
    : undefined;
  if (daemonClient.enabled()) {
    return new DaemonBasedTaskHasher(daemonClient, runnerOptions, ioSnapshots);
  } else {
    const { rustReferences } = getFileMap();
    return new InProcessTaskHasher(
      projectGraph,
      nxJson,
      rustReferences,
      runnerOptions,
      ioSnapshots
    );
  }
}
