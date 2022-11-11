import TaskList from './task-list';
/* nx-ignore-next-line */
import { useProjectGraphSelector } from '../feature-projects/hooks/use-project-graph-selector';
import {
  allProjectsSelector,
  workspaceLayoutSelector,
} from '../feature-projects/machines/selectors';
import { useTaskGraphSelector } from './hooks/use-task-graph-selector';
import { getTaskGraphService } from '../machines/get-services';

/* eslint-disable-next-line */
export interface TasksSidebarProps {}

export function TasksSidebar(props: TasksSidebarProps) {
  const projects = useProjectGraphSelector(allProjectsSelector);
  const workspaceLayout = useProjectGraphSelector(workspaceLayoutSelector);
  const taskGraph = getTaskGraphService();

  const selectedTask = useTaskGraphSelector(
    (state) => state.context.selectedTaskId
  );

  function selectTask(taskId: string) {
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
