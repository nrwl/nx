import TaskList from './task-list';
import {
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/dep-graph';
import { getGraphService } from '../machines/graph.service';
import { useEffect } from 'react';
import FocusedPanel from '../ui-components/focused-panel';
import CheckboxPanel from '../ui-components/checkbox-panel';

export function TasksSidebar() {
  const graphService = getGraphService();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProjectRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;
  const workspaceLayout = selectedProjectRouteData.layout;

  const routeData = useRouteLoaderData(
    'selectedTask'
  ) as TaskGraphClientResponse;
  const { taskGraphs } = routeData;
  const projects = selectedProjectRouteData.projects;
  // const projects = selectedProjectRouteData.projects.filter((project) => {
  //   return (
  //     Object.keys(project.data.targets).filter((target) => {
  //       const taskName = `${project.name}:${target}`;
  //       return (
  //         taskGraphs[taskName]?.dependencies[taskName]?.length > 0
  //       );
  //     }).length > 0
  //   );
  // });
  const selectedTask = params['selectedTaskId'];

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

  const groupByProject = searchParams.get('groupByProject') === 'true';

  useEffect(() => {
    if (groupByProject) {
      graphService.handleTaskEvent({
        type: 'setGroupByProject',
        groupByProject: true,
      });
    } else {
      graphService.handleTaskEvent({
        type: 'setGroupByProject',
        groupByProject: false,
      });
    }
  }, [searchParams]);

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

  function groupByProjectChanged(checked) {
    setSearchParams((currentSearchParams) => {
      if (checked) {
        currentSearchParams.set('groupByProject', 'true');
      } else {
        currentSearchParams.delete('groupByProject');
      }

      return currentSearchParams;
    });
  }

  return (
    <>
      {selectedTask ? (
        <FocusedPanel
          focusedLabel={selectedTask}
          resetFocus={resetFocus}
        ></FocusedPanel>
      ) : null}

      <CheckboxPanel
        checked={groupByProject}
        checkChanged={groupByProjectChanged}
        name={'groupByProject'}
        label={'Group by project'}
        description={'Visually arrange tasks by project.'}
      />

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
