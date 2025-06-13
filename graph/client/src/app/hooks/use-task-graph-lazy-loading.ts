import { useState, useCallback, useRef } from 'react';
import { loadSpecificTaskGraph } from '../routes';

// Local type definitions to avoid circular dependency
interface TaskGraph {
  tasks: any;
  dependencies: any;
  continuousDependencies: any;
  roots: any[];
}

interface TaskGraphClientResponse {
  taskGraphs: Record<string, TaskGraph>;
  plans?: Record<string, string[]>;
  errors?: Record<string, string>;
}

interface TaskGraphCache {
  [taskId: string]: TaskGraph;
}

interface TaskGraphMetadata {
  projects: Array<{
    name: string;
    targets: Array<{
      name: string;
      configurations?: string[];
    }>;
  }>;
}

export function useTaskGraphLazyLoading(
  selectedWorkspaceId: string,
  initialData?: TaskGraphClientResponse & { metadata?: TaskGraphMetadata }
) {
  const [taskGraphs, setTaskGraphs] = useState<TaskGraphCache>(
    initialData?.taskGraphs || {}
  );
  const [loadingTasks, setLoadingTasks] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<{ [taskId: string]: string }>(
    initialData?.errors || {}
  );

  const metadata = useRef<TaskGraphMetadata | null>(
    initialData?.metadata || null
  );

  const loadTaskGraph = useCallback(
    async (projectName: string, targetName: string, configuration?: string) => {
      const taskId = configuration
        ? `${projectName}:${targetName}:${configuration}`
        : `${projectName}:${targetName}`;

      // Return cached result if available
      if (taskGraphs[taskId]) {
        return taskGraphs[taskId];
      }

      // Avoid duplicate requests
      if (loadingTasks.has(taskId)) {
        return null;
      }

      setLoadingTasks((prev) => new Set(prev).add(taskId));

      try {
        const response = await loadSpecificTaskGraph(
          selectedWorkspaceId,
          projectName,
          targetName,
          configuration
        );

        setTaskGraphs((prev) => ({
          ...prev,
          ...response.taskGraphs,
        }));

        if (response.errors && Object.keys(response.errors).length > 0) {
          setErrors((prev) => ({
            ...prev,
            ...response.errors,
          }));
        }

        return response;
      } catch (error) {
        console.error(`Failed to load task graph for ${taskId}:`, error);
        setErrors((prev) => ({
          ...prev,
          [taskId]: error.message || 'Failed to load task graph',
        }));
        return null;
      } finally {
        setLoadingTasks((prev) => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
      }
    },
    [selectedWorkspaceId, taskGraphs, loadingTasks]
  );

  const getProjectTargets = useCallback((projectName: string) => {
    if (!metadata.current) {
      return [];
    }

    const project = metadata.current.projects.find(
      (p) => p.name === projectName
    );
    return project?.targets || [];
  }, []);

  const isTaskLoading = useCallback(
    (projectName: string, targetName: string, configuration?: string) => {
      const taskId = configuration
        ? `${projectName}:${targetName}:${configuration}`
        : `${projectName}:${targetName}`;
      return loadingTasks.has(taskId);
    },
    [loadingTasks]
  );

  const hasTaskGraph = useCallback(
    (projectName: string, targetName: string, configuration?: string) => {
      const taskId = configuration
        ? `${projectName}:${targetName}:${configuration}`
        : `${projectName}:${targetName}`;
      return !!taskGraphs[taskId];
    },
    [taskGraphs]
  );

  return {
    taskGraphs,
    loadTaskGraph,
    getProjectTargets,
    isTaskLoading,
    hasTaskGraph,
    errors,
    metadata: metadata.current,
  };
}
