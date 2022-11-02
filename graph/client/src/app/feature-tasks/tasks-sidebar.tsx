import TaskList from '../sidebar/task-list';
/* nx-ignore-next-line */
import { ProjectGraphNode } from 'nx/src/config/project-graph';

/* eslint-disable-next-line */
export interface TasksSidebarProps {}

export function TasksSidebar(props: TasksSidebarProps) {
  const mockProjects: ProjectGraphNode[] = [
    {
      name: 'app1',
      type: 'app',
      data: {
        root: 'apps/app1',
        targets: {
          build: {
            configurations: { production: {}, development: {} },
            defaultConfiguration: 'production',
          },
        },
      },
    },
    {
      name: 'nested-app',
      type: 'app',
      data: {
        root: 'apps/nested/app',
        targets: { build: { configurations: { production: {} } } },
      },
    },
    {
      name: 'app1-e2e',
      type: 'e2e',
      data: {
        root: 'apps/app1-e2e',
        targets: { e2e: { configurations: { production: {} } } },
      },
    },
    {
      name: 'lib1',
      type: 'lib',
      data: {
        root: 'libs/lib1',
        targets: { lint: { configurations: { production: {} } } },
      },
    },
  ];

  const mockWorkspaceLayout = {
    appsDir: 'apps',
    libsDir: 'libs',
  };

  const mockSelectedTask = 'app1:build:production';

  return (
    <TaskList
      projects={mockProjects}
      workspaceLayout={mockWorkspaceLayout}
      selectedTask={mockSelectedTask}
      selectTask={console.log}
    />
  );
}

export default TasksSidebar;
