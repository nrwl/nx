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

// nx-ignore-next-line
import { TargetConfiguration } from 'nx/src/config/workspace-json-project-json';

export function TasksSidebar() {
  const graphService = getGraphService();
  const navigate = useNavigate();
  const params = useParams();

  const [searchParams, setSearchParams] = useSearchParams();
  const groupByProject = searchParams.get('groupByProject') === 'true';
  const hideTasksWithoutDeps =
    searchParams.get('filterTasksWithoutDeps') !== 'false';

  const selectedProjectRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;
  const workspaceLayout = selectedProjectRouteData.layout;

  const routeData = useRouteLoaderData(
    'selectedTask'
  ) as TaskGraphClientResponse;
  const { taskGraphs } = routeData;
  let projects = selectedProjectRouteData.projects;

  if (searchParams.get('filterTasksWithoutDeps') !== 'false') {
    projects = projects
      .map((project) => {
        const targets: { [p: string]: TargetConfiguration } = {};

        Object.keys(project.data.targets).forEach((targetName) => {
          const taskName = `${project.name}:${targetName}`;
          if (taskGraphs[taskName]?.dependencies[taskName]?.length > 0) {
            targets[targetName] = project.data.targets[targetName];
          }
        });

        return Object.keys(targets).length > 0
          ? { ...project, data: { ...project.data, targets } }
          : null;
      })
      .filter((project) => project !== null);
  }

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
    if (taskId === selectedTask) return;

    if (selectedTask) {
      navigate(
        { pathname: `../${taskId}`, search: searchParams.toString() },
        { relative: 'path' }
      );
    } else {
      navigate(
        { pathname: `${taskId}`, search: searchParams.toString() },
        { relative: 'path' }
      );
    }
  }

  function resetFocus() {
    navigate('..', { relative: 'path' });
  }

  function groupByProjectChanged(checked) {
    setSearchParams(
      (currentSearchParams) => {
        if (checked) {
          currentSearchParams.set('groupByProject', 'true');
        } else {
          currentSearchParams.delete('groupByProject');
        }

        return currentSearchParams;
      },
      { relative: 'path' }
    );
  }

  function hideTasksWithoutDepsChanged(checked) {
    setSearchParams((currentSearchParams) => {
      if (!checked) {
        currentSearchParams.set('filterTasksWithoutDeps', 'false');
      } else {
        currentSearchParams.delete('filterTasksWithoutDeps');
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

      <CheckboxPanel
        checked={hideTasksWithoutDeps}
        checkChanged={hideTasksWithoutDepsChanged}
        name={'hideTasksWithoutDeps'}
        label={'Hide tasks without dependencies'}
        description={
          "Don't show tasks without dependencies, which means only that task will be executed when run."
        }
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
