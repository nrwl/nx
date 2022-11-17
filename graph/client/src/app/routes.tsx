import { Shell } from './shell';
import { redirect, RouteObject } from 'react-router-dom';
import ProjectsSidebar from './feature-projects/projects-sidebar';
import TasksSidebar from './feature-tasks/tasks-sidebar';
import { getEnvironmentConfig } from './hooks/use-environment-config';
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { getProjectGraphDataService } from './hooks/get-project-graph-data-service';

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

  return projectGraph;
};

const taskDataLoader = async (selectedProjectId: string) => {
  const projectInfo = appConfig.workspaces.find(
    (graph) => graph.id === selectedProjectId
  );

  return await projectGraphDataService.getTaskGraph(projectInfo.taskGraphUrl);
};

const childRoutes: RouteObject[] = [
  {
    path: 'projects',
    loader: () => {},
    element: <ProjectsSidebar />,
  },
  {
    loader: async ({ request, params }) => {
      const environmentConfig = getEnvironmentConfig();

      if (!environmentConfig.appConfig.showExperimentalFeatures) {
        return redirect(`/projects`);
      }

      const selectedProjectId =
        params.selectedProjectId ?? appConfig.defaultWorkspaceId;
      return taskDataLoader(selectedProjectId);
    },
    path: 'tasks',
    id: 'selectedTask',
    children: [
      {
        index: true,
        element: <TasksSidebar />,
      },
      {
        path: ':selectedTaskId',
        element: <TasksSidebar />,
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
        path: ':selectedProjectId',
        id: 'selectedWorkspace',
        element: <Shell />,
        loader: async ({ request, params }) => {
          const selectedProjectId =
            params.selectedProjectId ?? appConfig.defaultWorkspaceId;
          return workspaceDataLoader(selectedProjectId);
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
