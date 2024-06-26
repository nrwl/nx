import { redirect, RouteObject, json } from 'react-router-dom';
import { ProjectsSidebar } from './feature-projects/projects-sidebar';
import { TasksSidebar } from './feature-tasks/tasks-sidebar';
import { Shell } from './shell';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  GraphError,
  ProjectGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from 'nx/src/config/project-graph';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  getEnvironmentConfig,
  getProjectGraphDataService,
} from '@nx/graph/shared';
import { TasksSidebarErrorBoundary } from './feature-tasks/tasks-sidebar-error-boundary';
import { ProjectDetailsPage } from '@nx/graph/project-details';
import { ErrorBoundary } from './ui-components/error-boundary';

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

const taskDataLoader = async (selectedWorkspaceId: string) => {
  const workspaceInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  return await projectGraphDataService.getTaskGraph(workspaceInfo.taskGraphUrl);
};

const sourceMapsLoader = async (selectedWorkspaceId: string) => {
  const workspaceInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  return await projectGraphDataService.getSourceMaps(
    workspaceInfo.sourceMapsUrl
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
  };
};

const childRoutes: RouteObject[] = [
  {
    path: 'projects',
    children: [
      {
        index: true,
        element: <ProjectsSidebar />,
      },
      {
        path: 'all',
        element: <ProjectsSidebar />,
      },
      {
        path: 'affected',
        element: <ProjectsSidebar />,
      },
      {
        path: ':focusedProject',
        element: <ProjectsSidebar />,
      },
      {
        path: 'trace/:startTrace',
        element: <ProjectsSidebar />,
      },
      {
        path: 'trace/:startTrace/:endTrace',
        element: <ProjectsSidebar />,
      },
    ],
  },
  {
    loader: async ({ request, params }) => {
      const selectedWorkspaceId =
        params.selectedWorkspaceId ?? appConfig.defaultWorkspaceId;
      return taskDataLoader(selectedWorkspaceId);
    },
    path: 'tasks',
    id: 'selectedTarget',
    errorElement: <TasksSidebarErrorBoundary />,
    shouldRevalidate: ({ currentParams, nextParams }) => {
      return (
        !currentParams.selectedWorkspaceId ||
        currentParams.selectedWorkspaceId !== nextParams.selectedWorkspaceId
      );
    },
    children: [
      {
        index: true,
        element: <TasksSidebar />,
      },
      {
        path: ':selectedTarget',
        element: <TasksSidebar />,
        children: [
          {
            path: 'all',
            element: <TasksSidebar />,
          },
        ],
      },
    ],
  },
];

export const devRoutes: RouteObject[] = [
  {
    path: '/',
    errorElement: <ErrorBoundary />,
    children: [
      {
        index: true,
        loader: async ({ request, params }) => {
          const { search } = new URL(request.url);

          return redirect(`/${appConfig.defaultWorkspaceId}/projects${search}`);
        },
      },
      {
        path: ':selectedWorkspaceId',
        id: 'selectedWorkspace',
        element: <Shell />,
        shouldRevalidate: ({ currentParams, nextParams }) => {
          return (
            currentParams.selectedWorkspaceId !== nextParams.selectedWorkspaceId
          );
        },
        loader: async ({ request, params }) => {
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
    element: <Shell />,
    children: [
      {
        index: true,
        loader: ({ request }) => {
          const { search } = new URL(request.url);

          return redirect(`/projects${search}`);
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
