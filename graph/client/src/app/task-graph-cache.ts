import type { TaskGraphClientResponse } from '@nx/graph-shared';

interface CacheEntry {
  taskGraph: TaskGraphClientResponse['taskGraph'];
  plans?: Record<string, string[]>;
  error?: string | null;
  // Track which projects we've fetched for this combination
  fetchedProjects: Set<string>;
  // Track if we've fetched ALL projects for this combination
  hasAllProjects: boolean;
}

class TaskGraphCache {
  private cache: Map<string, CacheEntry> = new Map();
  private currentWorkspaceId: string | null = null;

  /**
   * Clear cache when workspace changes
   */
  setWorkspace(workspaceId: string) {
    if (this.currentWorkspaceId !== workspaceId) {
      this.cache.clear();
      this.currentWorkspaceId = workspaceId;
    }
  }

  /**
   * Get cached data for a cache key, considering which projects are requested
   */
  getCached(
    cacheKey: string,
    requestedProjects?: string[]
  ): TaskGraphClientResponse | null {
    const cacheEntry = this.cache.get(cacheKey);
    if (!cacheEntry) {
      return null;
    }

    // If no specific projects requested, check if we have all projects
    if (!requestedProjects || requestedProjects.length === 0) {
      if (cacheEntry.hasAllProjects) {
        // We have all projects cached for this combination
        return {
          taskGraph: cacheEntry.taskGraph,
          plans: cacheEntry.plans,
          error: cacheEntry.error,
        };
      }
      // We don't have all projects, need to fetch
      return null;
    }

    // Check if we have all requested projects cached
    const missingProjects = requestedProjects.filter(
      (project) => !cacheEntry.fetchedProjects.has(project)
    );

    if (missingProjects.length === 0) {
      // We have all requested projects, return the cached data
      return {
        taskGraph: cacheEntry.taskGraph,
        plans: cacheEntry.plans,
        error: cacheEntry.error,
      };
    }

    // We're missing some projects, need to fetch
    return null;
  }

  /**
   * Update cache with new data
   */
  updateCache(
    cacheKey: string,
    response: TaskGraphClientResponse,
    requestedProjects?: string[],
    isAllProjects: boolean = false
  ) {
    const existing = this.cache.get(cacheKey) || {
      taskGraph: {
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      },
      plans: {},
      error: null,
      fetchedProjects: new Set<string>(),
      hasAllProjects: false,
    };

    // Create new cache entry
    const merged: CacheEntry = {
      taskGraph: response.taskGraph,
      plans: response.plans,
      error: response.error,
      fetchedProjects: new Set(existing.fetchedProjects),
      hasAllProjects: existing.hasAllProjects || isAllProjects,
    };

    // Update fetched projects tracking
    if (isAllProjects) {
      // Mark that we have all projects for this combination
      merged.hasAllProjects = true;
      // Add all projects from the response to fetchedProjects
      Object.keys(response.taskGraph.tasks).forEach((taskId) => {
        const task = response.taskGraph.tasks[taskId];
        merged.fetchedProjects.add(task.target.project);
      });
    } else if (requestedProjects) {
      // Add specific projects to the set
      requestedProjects.forEach((project) => {
        merged.fetchedProjects.add(project);
      });
    }

    this.cache.set(cacheKey, merged);
  }

  /**
   * Get merged response combining cached and new data
   */
  getMergedResponse(
    cacheKey: string,
    newResponse: TaskGraphClientResponse,
    requestedProjects?: string[],
    isAllProjects: boolean = false
  ): TaskGraphClientResponse {
    // Update the cache first
    this.updateCache(cacheKey, newResponse, requestedProjects, isAllProjects);

    // Return the cached data for this cache key
    const cached = this.cache.get(cacheKey);
    return {
      taskGraph: cached?.taskGraph || {
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      },
      plans: cached?.plans || {},
      error: cached?.error || null,
    };
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }
}

// Singleton instance
export const taskGraphCache = new TaskGraphCache();
