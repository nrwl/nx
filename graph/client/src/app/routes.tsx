import { redirect, RouteObject, json, LoaderFunction } from 'react-router-dom';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  GraphError,
  ProjectGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
import {
  getEnvironmentConfig,
  getProjectGraphDataService,
} from '@nx/graph-shared';
import { TasksSidebarErrorBoundary } from './feature-tasks/tasks-sidebar-error-boundary';
import { ProjectDetailsPage } from '@nx/graph-internal-project-details';
import { ErrorBoundary } from './ui-components/error-boundary';
import { taskGraphClientCache } from './task-graph-client-cache';
import { ProjectsShell } from './feature-projects/projects-shell';
import { TasksShell } from './feature-tasks/tasks-shell';
import { GraphStateSerializer } from '@nx/graph';

const { appConfig } = getEnvironmentConfig();
const projectGraphDataService = getProjectGraphDataService();

export function getRoutesForEnvironment() {
  if (getEnvironmentConfig().environment === 'dev') {
    return devRoutes;
  } else {
    return releaseRoutes;
  }
}

const workspaceDataLoader = async (selectedWorkspaceId: string) => {
  const workspaceInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  if (!workspaceInfo) {
    throw new Error(`Workspace ${selectedWorkspaceId} not found`);
  }

  projectGraphDataService.setTaskInputsUrl?.(workspaceInfo.taskInputsUrl);

  const projectGraph: ProjectGraphClientResponse =
    await projectGraphDataService.getProjectGraph(
      workspaceInfo.projectGraphUrl
    );

  const targetsSet = new Set<string>();

  projectGraph.projects.forEach((project) => {
    Object.keys(project.data.targets ?? {}).forEach((targetName) => {
      targetsSet.add(targetName);
    });
  });

  const targets = Array.from(targetsSet).sort((a, b) => a.localeCompare(b));

  const sourceMaps = await sourceMapsLoader(selectedWorkspaceId);

  return { ...projectGraph, targets, sourceMaps };
};

const sourceMapsLoader = async (selectedWorkspaceId: string) => {
  const workspaceInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  if (!workspaceInfo) {
    throw new Error(`Workspace ${selectedWorkspaceId} not found`);
  }

  return await projectGraphDataService.getSourceMaps(
    workspaceInfo.sourceMapsUrl
  );
};

const tasksLoader: LoaderFunction = async ({ params, request }) => {
  const selectedWorkspaceId =
    params.selectedWorkspaceId ?? appConfig.defaultWorkspaceId;

  const workspaceInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  if (!workspaceInfo) {
    throw new Error(`Workspace ${selectedWorkspaceId} not found`);
  }

  // bust the task graph cache if workspaceId changes
  taskGraphClientCache.setWorkspace(selectedWorkspaceId);

  const requestUrl = new URL(request.url);
  const targetsParam = requestUrl.searchParams.get('targets');
  const projectsParam = requestUrl.searchParams.get('projects');

  const selectedTargets = targetsParam
    ? targetsParam.split(' ').filter(Boolean)
    : [];
  const requestedProjects = projectsParam
    ? projectsParam.split(' ').filter(Boolean)
    : undefined;

  // if no targets are selected, empty taskGraph response
  if (selectedTargets.length === 0) {
    return {
      taskGraph: {
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      },
      error: null,
    };
  }

  const isAllRoute = requestUrl.pathname.endsWith('/all');

  // if we don't request any projects and we're not on the "all" route,
  // we return empty taskGraph response. consumers need to select projects
  if (!requestedProjects && !isAllRoute) {
    return {
      taskGraph: {
        tasks: {},
        dependencies: {},
        continuousDependencies: {},
        roots: [],
      },
      error: null,
    };
  }

  // Check if we have cached data for this exact combination
  const { cached, missingTargets, missingProjects } =
    taskGraphClientCache.getCached(selectedTargets, requestedProjects);

  if (cached) return cached;

  const response = await projectGraphDataService.getSpecificTaskGraph(
    workspaceInfo.taskGraphUrl,
    missingProjects,
    missingTargets
  );

  if (response.error) return response;

  // only merge if we don't have error
  return taskGraphClientCache.mergeTaskGraph(
    response,
    missingTargets,
    missingProjects
  );
};

const projectDetailsLoader = async (
  selectedWorkspaceId: string,
  projectName: string
): Promise<{
  hash: string;
  project: ProjectGraphProjectNode;
  sourceMap: Record<string, string[]>;
  errors?: GraphError[];
  connectedToCloud?: boolean;
  disabledTaskSyncGenerators?: string[];
}> => {
  const workspaceData = await workspaceDataLoader(selectedWorkspaceId);
  const sourceMaps = await sourceMapsLoader(selectedWorkspaceId);

  const project = workspaceData.projects.find(
    (project) => project.name === projectName
  );
  if (!project) {
    throw json({
      id: 'project-not-found',
      projectName,
      errors: workspaceData.errors,
    });
  }
  return {
    hash: workspaceData.hash,
    project,
    sourceMap: sourceMaps[project.data.root],
    errors: workspaceData.errors,
    connectedToCloud: workspaceData.connectedToCloud,
    disabledTaskSyncGenerators: workspaceData.disabledTaskSyncGenerators,
  };
};

const childRoutes: RouteObject[] = [
  { path: 'projects', element: <ProjectsShell /> },
  {
    path: 'tasks',
    id: 'tasks',
    element: <TasksShell />,
    errorElement: <TasksSidebarErrorBoundary />,
    loader: tasksLoader,
    shouldRevalidate: ({ currentParams, nextParams, currentUrl, nextUrl }) => {
      // Always revalidate if workspace changes
      if (
        !currentParams.selectedWorkspaceId ||
        currentParams.selectedWorkspaceId !== nextParams.selectedWorkspaceId
      ) {
        return true;
      }

      // Revalidate if query parameters change (targets or projects)
      const currentSearchParams = new URLSearchParams(currentUrl.search);
      const nextSearchParams = new URLSearchParams(nextUrl.search);

      const currentTargets = currentSearchParams.get('targets');
      const nextTargets = nextSearchParams.get('targets');
      const currentProjects = currentSearchParams.get('projects');
      const nextProjects = nextSearchParams.get('projects');

      return currentTargets !== nextTargets || currentProjects !== nextProjects;
    },
  },
];

function handleRawGraphQueryParam(searchParams: URLSearchParams) {
  const rawGraph = searchParams.get('rawGraph');
  // nothing to do here, bail
  if (!rawGraph) return;

  try {
    const rawGraphJson = JSON.parse(rawGraph);
    searchParams.delete('rawGraph');
    searchParams.set('graph', GraphStateSerializer.serialize(rawGraphJson));
  } catch (err) {
    console.error('Graph Client: error during rawGraph handling', err);
    return;
  }
}

export const devRoutes: RouteObject[] = [
  {
    path: '/',
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        loader: async ({ request }) => {
          const { searchParams } = new URL(request.url);
          handleRawGraphQueryParam(searchParams);
          return redirect(
            `/${
              appConfig.defaultWorkspaceId
            }/projects?${searchParams.toString()}`
          );
        },
      },
      {
        path: ':selectedWorkspaceId',
        id: 'selectedWorkspace',
        shouldRevalidate: ({ currentParams, nextParams }) => {
          return (
            currentParams.selectedWorkspaceId !== nextParams.selectedWorkspaceId
          );
        },
        loader: async ({ params }) => {
          const selectedWorkspaceId =
            params.selectedWorkspaceId ?? appConfig.defaultWorkspaceId;
          return workspaceDataLoader(selectedWorkspaceId);
        },
        children: childRoutes,
      },
      {
        path: ':selectedWorkspaceId/project-details/:projectName',
        id: 'selectedProjectDetails',
        element: <ProjectDetailsPage />,
        loader: async ({ params }) => {
          const projectName = params.projectName;
          return projectDetailsLoader(params.selectedWorkspaceId, projectName);
        },
      },
    ],
  },
];

export const releaseRoutes: RouteObject[] = [
  {
    path: '/',
    id: 'selectedWorkspace',
    loader: async () => {
      const selectedWorkspaceId = appConfig.defaultWorkspaceId;
      return workspaceDataLoader(selectedWorkspaceId);
    },
    shouldRevalidate: () => {
      return false;
    },
    children: [
      {
        index: true,
        loader: ({ request }) => {
          const { searchParams } = new URL(request.url);
          handleRawGraphQueryParam(searchParams);
          return redirect(`/projects?${searchParams.toString()}`);
        },
      },
      ...childRoutes,
    ],
    errorElement: <ErrorBoundary />,
  },
  {
    path: 'project-details/:projectName',
    id: 'selectedProjectDetails',
    element: <ProjectDetailsPage />,
    errorElement: <ErrorBoundary />,
    loader: async ({ params }) => {
      const projectName = params.projectName;
      return projectDetailsLoader(appConfig.defaultWorkspaceId, projectName);
    },
  },
];
