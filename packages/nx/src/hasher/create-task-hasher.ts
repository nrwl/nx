import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import type { IoSnapshots } from '../native';
import type { TaskPlanningContext } from './task-planning-context';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

/**
 * `ioSnapshots` is this run's set (see `loadIoSnapshotsForRun`); undefined
 * hashes natively. The daemon gets its version, so it hashes from the same
 * set even after a newer one is imported for the commit.
 */
export function createTaskHasher(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  runnerOptions?: any,
  ioSnapshots?: IoSnapshots,
  planningContext?: TaskPlanningContext
): TaskHasher {
  if (daemonClient.enabled()) {
    return new DaemonBasedTaskHasher(
      daemonClient,
      runnerOptions,
      ioSnapshots
        ? {
            commit: ioSnapshots.commit,
            fetchedAt: ioSnapshots.resolution.fetchedAt,
          }
        : undefined
    );
  } else {
    const { rustReferences } = getFileMap();
    return new InProcessTaskHasher(
      projectGraph,
      nxJson,
      rustReferences,
      runnerOptions,
      ioSnapshots,
      planningContext
    );
  }
}
