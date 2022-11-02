import { Shell } from './shell';
import { redirect } from 'react-router-dom';
import ProjectsSidebar from './feature-projects/projects-sidebar';
import TasksSidebar from './feature-tasks/tasks-sidebar';
import { getEnvironmentConfig } from './hooks/use-environment-config';
import { getDepGraphService } from './machines/dep-graph.service';
// nx-ignore-next-line
import { DepGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { getProjectGraphDataService } from './hooks/get-project-graph-data-service';

export const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        loader: async ({ request, params }) => {
          const { search } = new URL(request.url);

          const { appConfig } = getEnvironmentConfig();
          const selectedProjectId = appConfig.defaultProjectGraph;
          const projectInfo = appConfig.projectGraphs.find(
            (graph) => graph.id === selectedProjectId
          );
          const projectGraphService = getProjectGraphDataService();
          const depGraphService = getDepGraphService();

          const fetchProjectGraph = async () => {
            const project: DepGraphClientResponse =
              await projectGraphService.getProjectGraph(projectInfo.url);

            const workspaceLayout = project?.layout;
            depGraphService.send({
              type: 'initGraph',
              projects: project.projects,
              dependencies: project.dependencies,
              affectedProjects: project.affected,
              workspaceLayout: workspaceLayout,
            });
          };
          await fetchProjectGraph();

          return redirect(`/projects${search}`);
        },
      },
      {
        path: 'projects',
        element: <ProjectsSidebar />,
        children: [
          {
            path: 'select/all',
            loader: () => {
              const depGraphService = getDepGraphService();

              depGraphService.send('selectAll');
            },
          },
        ],
      },
      {
        loader: ({ request, params }) => {
          const environmentConfig = getEnvironmentConfig();

          if (!environmentConfig.appConfig.showExperimentalFeatures) {
            return redirect(`/projects`);
          } else {
            return null;
          }
        },
        path: 'tasks',
        element: <TasksSidebar />,
      },
    ],
  },
  {
    path: '*',
    loader: () => {
      return redirect('/projects');
    },
  },
];
