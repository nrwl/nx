import { Shell } from './shell';
import { redirect, RouteObject } from 'react-router-dom';
import ProjectsSidebar from './feature-projects/projects-sidebar';
import TasksSidebar from './feature-tasks/tasks-sidebar';
import { getEnvironmentConfig } from './hooks/use-environment-config';
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { getProjectGraphDataService } from './hooks/get-project-graph-data-service';
import { getProjectGraphService } from './machines/get-services';

const { appConfig } = getEnvironmentConfig();
const projectGraphDataService = getProjectGraphDataService();

export function getRoutesForEnvironment() {
  if (getEnvironmentConfig().environment === 'dev') {
    return devRoutes;
  } else {
    return releaseRoutes;
  }
}

const projectDataLoader = async (selectedProjectId: string) => {
  const projectInfo = appConfig.projects.find(
    (graph) => graph.id === selectedProjectId
  );

  const projectGraph: ProjectGraphClientResponse =
    await projectGraphDataService.getProjectGraph(projectInfo.projectGraphUrl);

  return projectGraph;
};

const taskDataLoader = async (selectedProjectId: string) => {
  const projectInfo = appConfig.projects.find(
    (graph) => graph.id === selectedProjectId
  );

  return await projectGraphDataService.getTaskGraph(projectInfo.taskGraphUrl);
};

const childRoutes: RouteObject[] = [
  {
    path: 'projects',
    loader: () => {
      getProjectGraphService().start();
    },
    element: <ProjectsSidebar />,
  },
  {
    loader: async ({ request, params }) => {
      const environmentConfig = getEnvironmentConfig();

      if (!environmentConfig.appConfig.showExperimentalFeatures) {
        return redirect(`/projects`);
      }

      getProjectGraphService().stop();

      const selectedProjectId =
        params.selectedProjectId ?? appConfig.defaultProject;
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
        path: ':selectedTask',
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

          return redirect(`/${appConfig.defaultProject}/projects${search}`);
        },
      },
      {
        path: ':selectedProjectId',
        id: 'SelectedProject',
        element: <Shell />,
        loader: async ({ request, params }) => {
          const selectedProjectId =
            params.selectedProjectId ?? appConfig.defaultProject;
          return projectDataLoader(selectedProjectId);
        },
        children: childRoutes,
      },
    ],
  },
];

export const releaseRoutes: RouteObject[] = [
  {
    path: '/',
    id: 'SelectedProject',
    loader: async ({ request, params }) => {
      const selectedProjectId =
        params.selectedProjectId ?? appConfig.defaultProject;
      return projectDataLoader(selectedProjectId);
    },
    element: <Shell />,
    children: [
      {
        index: true,
        loader: () => {
          return redirect(`/projects/`);
        },
      },
      ...childRoutes,
    ],
  },
];
