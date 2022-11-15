import TaskList from './task-list';
import { useNavigate, useParams, useRouteLoaderData } from 'react-router-dom';
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/dep-graph';
import { getGraphService } from '../machines/graph.service';
import { useEffect } from 'react';
import FocusedPanel from '../ui-components/focused-panel';

export function TasksSidebar() {
  const graphService = getGraphService();
  const navigate = useNavigate();
  const params = useParams();

  const selectedProjectRouteData = useRouteLoaderData(
    'SelectedProject'
  ) as ProjectGraphClientResponse;
  const projects = selectedProjectRouteData.projects;
  const workspaceLayout = selectedProjectRouteData.layout;

  const routeData = useRouteLoaderData(
    'selectedTask'
  ) as TaskGraphClientResponse;
  const { taskGraphs } = routeData;

  const selectedTask = params['selectedTask'];

  useEffect(() => {
    graphService.handleTaskEvent({
      type: 'notifyTaskGraphSetProjects',
      projects: selectedProjectRouteData.projects,
      taskGraphs,
    });
  }, [selectedProjectRouteData]);

  useEffect(() => {
    if (selectedTask) {
      graphService.handleTaskEvent({
        type: 'notifyTaskGraphTaskSelected',
        taskId: selectedTask,
      });
    } else {
      graphService.handleTaskEvent({
        type: 'notifyTaskGraphDeselectTask',
      });
    }
  }, [params]);

  function selectTask(taskId: string) {
    if (selectedTask) {
      navigate(`../${taskId}`);
    } else {
      navigate(`./${taskId}`);
    }
  }

  function resetFocus() {
    navigate('..');
  }

  return (
    <>
      {selectedTask ? (
        <FocusedPanel
          focusedLabel={selectedTask}
          resetFocus={resetFocus}
        ></FocusedPanel>
      ) : null}
      <TaskList
        projects={projects}
        workspaceLayout={workspaceLayout}
        selectedTask={selectedTask}
        selectTask={selectTask}
      />
    </>
  );
}

export default TasksSidebar;
