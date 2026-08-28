import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import type { TaskPlanningContext } from './task-planning-context';
import type { IoSnapshots } from '../native';
import { getFileMap } from '../project-graph/build-project-graph';
import {
  DaemonBasedTaskHasher,
  InProcessTaskHasher,
  TaskHasher,
} from './task-hasher';

/**
 * `ioSnapshots` is this run's fetched bundle (see `fetchIoSnapshotsForRun`);
 * undefined hashes natively. The daemon receives only its directory and
 * loads the same bundle itself.
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
      ioSnapshots?.directory ? { directory: ioSnapshots.directory } : undefined
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
