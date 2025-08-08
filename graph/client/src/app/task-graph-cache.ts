/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { TaskGraphClientResponse } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

interface CacheEntry {
  taskGraphs: TaskGraphClientResponse['taskGraphs'];
  errors: Record<string, string>;
  // Track which projects we've fetched for this target
  fetchedProjects: Set<string>;
  // Track if we've fetched ALL projects for this target
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
   * Get cached data for a target, considering which projects are requested
   */
  getCached(
    target: string,
    requestedProjects?: string[]
  ): TaskGraphClientResponse | null {
    const cacheEntry = this.cache.get(target);
    if (!cacheEntry) {
      return null;
    }

    // If no specific projects requested, check if we have all projects
    if (!requestedProjects || requestedProjects.length === 0) {
      if (cacheEntry.hasAllProjects) {
        // We have all projects cached for this target
        return {
          taskGraphs: cacheEntry.taskGraphs,
          errors: cacheEntry.errors,
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
      // We have all requested projects, return filtered result
      const filteredGraphs: TaskGraphClientResponse['taskGraphs'] = {};
      const filteredErrors: Record<string, string> = {};

      for (const project of requestedProjects) {
        const taskId = `${project}:${target}`;
        if (cacheEntry.taskGraphs[taskId]) {
          filteredGraphs[taskId] = cacheEntry.taskGraphs[taskId];
        }
        if (cacheEntry.errors[taskId]) {
          filteredErrors[taskId] = cacheEntry.errors[taskId];
        }
      }

      return {
        taskGraphs: filteredGraphs,
        errors: filteredErrors,
      };
    }

    // We're missing some projects, need to fetch
    return null;
  }

  /**
   * Get list of projects we need to fetch (not yet cached)
   */
  getMissingProjects(
    target: string,
    requestedProjects?: string[]
  ): string[] | null {
    const cacheEntry = this.cache.get(target);

    // If no specific projects requested
    if (!requestedProjects || requestedProjects.length === 0) {
      // If we already have all projects, return empty array
      if (cacheEntry?.hasAllProjects) {
        return [];
      }
      // Need to fetch all projects for this target
      return null; // null means fetch all
    }

    if (!cacheEntry) {
      // Nothing cached yet, need all requested projects
      return requestedProjects;
    }

    // Return only the projects we haven't fetched yet
    return requestedProjects.filter(
      (project) => !cacheEntry.fetchedProjects.has(project)
    );
  }

  /**
   * Update cache with new data
   */
  updateCache(
    target: string,
    response: TaskGraphClientResponse,
    requestedProjects?: string[],
    isAllProjects: boolean = false
  ) {
    const existing = this.cache.get(target) || {
      taskGraphs: {},
      errors: {},
      fetchedProjects: new Set<string>(),
      hasAllProjects: false,
    };

    // Merge task graphs
    const merged: CacheEntry = {
      taskGraphs: { ...existing.taskGraphs, ...response.taskGraphs },
      errors: { ...existing.errors, ...response.errors },
      fetchedProjects: new Set(existing.fetchedProjects),
      hasAllProjects: existing.hasAllProjects || isAllProjects,
    };

    // Update fetched projects tracking
    if (isAllProjects) {
      // Mark that we have all projects for this target
      merged.hasAllProjects = true;
      // Add all projects from the response to fetchedProjects
      Object.keys(response.taskGraphs).forEach((taskId) => {
        const [project] = taskId.split(':');
        merged.fetchedProjects.add(project);
      });
    } else if (requestedProjects) {
      // Add specific projects to the set
      requestedProjects.forEach((project) => {
        merged.fetchedProjects.add(project);
      });
    }

    this.cache.set(target, merged);
  }

  /**
   * Get merged response combining cached and new data
   */
  getMergedResponse(
    target: string,
    newResponse: TaskGraphClientResponse,
    requestedProjects?: string[],
    isAllProjects: boolean = false
  ): TaskGraphClientResponse {
    // Update the cache first
    this.updateCache(target, newResponse, requestedProjects, isAllProjects);

    // Return the appropriate response based on what was requested
    if (!requestedProjects || requestedProjects.length === 0) {
      // Return all cached data for this target
      const cached = this.cache.get(target);
      return {
        taskGraphs: cached?.taskGraphs || {},
        errors: cached?.errors || {},
      };
    }

    // Return only the requested projects
    const cached = this.cache.get(target);
    const filteredGraphs: TaskGraphClientResponse['taskGraphs'] = {};
    const filteredErrors: Record<string, string> = {};

    for (const project of requestedProjects) {
      const taskId = `${project}:${target}`;
      if (cached?.taskGraphs[taskId]) {
        filteredGraphs[taskId] = cached.taskGraphs[taskId];
      }
      if (cached?.errors[taskId]) {
        filteredErrors[taskId] = cached.errors[taskId];
      }
    }

    return {
      taskGraphs: filteredGraphs,
      errors: filteredErrors,
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
