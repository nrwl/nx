import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import type { IoSnapshots } from '../native';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

/**
 * `ioSnapshots` is this run's set (see `resolveIoSnapshotsForRun`); undefined
 * hashes natively. The daemon gets only its commit.
 */
export function createTaskHasher(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  runnerOptions?: any,
  ioSnapshots?: IoSnapshots
): TaskHasher {
  if (daemonClient.enabled()) {
    return new DaemonBasedTaskHasher(
      daemonClient,
      runnerOptions,
      ioSnapshots?.commit ? { commit: ioSnapshots.commit } : undefined
    );
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
