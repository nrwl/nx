// nx-ignore-next-line
import type { TaskGraphClientResponse } from 'nx/src/command-line/graph/graph';

class TaskGraphClientCache {
  private cached: TaskGraphClientResponse | null = null;
  private currentWorkspaceId: string | null = null;
  private fetchedSet = new Set<string>();

  setWorkspace(workspaceId: string) {
    if (this.currentWorkspaceId === workspaceId) return;
    this.currentWorkspaceId = workspaceId;
    this.clear();
  }

  getCached(targets: string[], requestedProjects?: string[]) {
    // if we don't have cached result yet, we'll always fetch
    if (!this.cached) {
      return {
        cached: null,
        missingTargets: targets,
        missingProjects: requestedProjects,
      };
    }

    // this means we're fetching "all" for all targets
    if (!requestedProjects || requestedProjects.length === 0) {
      const missingTargets: string[] = [];
      for (const target of targets) {
        const targetWithAllKey = `${target}:all`;
        // if we already fetch for this target, skip
        if (this.fetchedSet.has(targetWithAllKey)) continue;
        missingTargets.push(target);
      }

      // no missing targets needed, we return the cached
      return {
        cached: missingTargets.length === 0 ? this.cached : null,
        missingTargets,
      };
    }

    const missingTargetsSet = new Set<string>();
    const missingProjectsSet = new Set<string>();

    for (const target of targets) {
      for (const project of requestedProjects) {
        const key = `${target}:${project}`;
        if (this.fetchedSet.has(key)) continue;

        missingTargetsSet.add(target);
        missingProjectsSet.add(project);
      }
    }

    if (missingTargetsSet.size === 0 && missingProjectsSet.size === 0) {
      return { cached: this.cached, missingTargets: [] };
    }

    return {
      cached: null,
      missingTargets: Array.from(missingTargetsSet),
      missingProjects: Array.from(missingProjectsSet),
    };
  }

  mergeTaskGraph(
    response: TaskGraphClientResponse,
    fetchedTargets: string[],
    fetchedProjects?: string[]
  ) {
    // populate the fetchedSet with targets and projects that were used
    // in the request
    if (!fetchedProjects) {
      fetchedTargets.forEach((fetchedTarget) => {
        this.fetchedSet.add(`${fetchedTarget}:all`);
      });
    } else {
      for (const fetchedTarget of fetchedTargets) {
        for (const fetchedProject of fetchedProjects) {
          this.fetchedSet.add(`${fetchedTarget}:${fetchedProject}`);
        }
      }
    }

    const mergedTasks = {
      ...this.cached?.taskGraph.tasks,
      ...response.taskGraph.tasks,
    };

    const rootsSet = new Set<string>(this.cached?.taskGraph.roots || []);
    for (const root of response.taskGraph.roots) {
      rootsSet.add(root);
    }

    const mergedDependencies = this.mergeCollectionRecord(
      this.cached?.taskGraph.dependencies,
      response.taskGraph.dependencies
    );

    const mergedContinuousDependencies = this.mergeCollectionRecord(
      this.cached?.taskGraph.continuousDependencies,
      response.taskGraph.continuousDependencies
    );

    const mergedTaskGraph = {
      tasks: mergedTasks,
      roots: Array.from(rootsSet),
      dependencies: mergedDependencies,
      continuousDependencies: mergedContinuousDependencies,
    };

    const mergedPlans = this.mergeCollectionRecord(
      this.cached?.plans,
      response.plans
    );

    this.cached = {
      taskGraph: mergedTaskGraph,
      plans: mergedPlans,
      error: response.error || this.cached?.error || null,
    };

    return this.cached;
  }

  clear() {
    this.cached = null;
    this.fetchedSet.clear();
  }

  private mergeCollectionRecord<T>(
    cachedRecord?: Record<string, T[]>,
    responseRecord?: Record<string, T[]>
  ) {
    const mergedRecord: Record<string, T[]> = {};

    for (const taskId in cachedRecord) {
      mergedRecord[taskId] = cachedRecord[taskId];
    }

    for (const taskId in responseRecord) {
      const byValue = new Map<string, T>();
      for (const item of [
        ...(mergedRecord[taskId] || []),
        ...(responseRecord[taskId] || []),
      ]) {
        byValue.set(JSON.stringify(item), item);
      }
      mergedRecord[taskId] = Array.from(byValue.values());
    }

    return mergedRecord;
  }
}

export const taskGraphClientCache = new TaskGraphClientCache();
