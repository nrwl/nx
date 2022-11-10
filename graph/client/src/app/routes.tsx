import { Shell } from './shell';
import { redirect } from 'react-router-dom';
import ProjectsSidebar from './feature-projects/projects-sidebar';
import TasksSidebar from './feature-tasks/tasks-sidebar';
import { getEnvironmentConfig } from './hooks/use-environment-config';

export const routes = [
  {
    path: '/',
    element: <Shell />,
    children: [
      {
        index: true,
        loader: async ({ request, params }) => {
          const { search } = new URL(request.url);

          return redirect(`/projects${search}`);
        },
      },
      {
        path: 'projects',
        element: <ProjectsSidebar />,
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
