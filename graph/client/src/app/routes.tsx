import { Shell } from './shell';
import { redirect, RouteObject } from 'react-router-dom';
import { ProjectsSidebar } from './feature-projects/projects-sidebar';
import { TasksSidebar } from './feature-tasks/tasks-sidebar';
import { getEnvironmentConfig } from './hooks/use-environment-config';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { getProjectGraphDataService } from './hooks/get-project-graph-data-service';
import { TasksSidebarErrorBoundary } from './feature-tasks/tasks-sidebar-error-boundary';

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

  return { ...projectGraph, targets };
};

const taskDataLoader = async (selectedWorkspaceId: string) => {
  const projectInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedWorkspaceId
  );

  return await projectGraphDataService.getTaskGraph(projectInfo.taskGraphUrl);
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
    ],
  },
];

export const releaseRoutes: RouteObject[] = [
  {
    path: '/',
    id: 'selectedWorkspace',
    loader: async ({ request, params }) => {
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
  },
];
