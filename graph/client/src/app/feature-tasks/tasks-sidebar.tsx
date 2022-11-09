import TaskList from './task-list';
/* nx-ignore-next-line */
import { ProjectGraphNode } from 'nx/src/config/project-graph';
import { useDepGraphService } from '../hooks/use-dep-graph';
import { useDepGraphSelector } from '../hooks/use-dep-graph-selector';
import {
  allProjectsSelector,
  workspaceLayoutSelector,
} from '../machines/selectors';
import { useTaskGraphSelector } from '../hooks/use-task-graph-selector';
import { getTaskGraphService } from '../machines/get-services';

/* eslint-disable-next-line */
export interface TasksSidebarProps {}

export function TasksSidebar(props: TasksSidebarProps) {
  const projects = useDepGraphSelector(allProjectsSelector);
  const workspaceLayout = useDepGraphSelector(workspaceLayoutSelector);
  const taskGraph = getTaskGraphService();

  const selectedTask = useTaskGraphSelector(
    (state) => state.context.selectedTaskId
  );
  function selectTask(
    projectName: string,
    targetName: string,
    configurationName: string
  ) {
    const taskId = `${projectName}:${targetName}:${configurationName}`;
    taskGraph.send({ type: 'selectTask', taskId });
  }

  return (
    <TaskList
      projects={projects}
      workspaceLayout={workspaceLayout}
      selectedTask={selectedTask}
      selectTask={selectTask}
    />
  );
}

export default TasksSidebar;
