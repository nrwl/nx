import { TaskList } from './task-list';
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
import { useEffect, useState } from 'react';
import { CheckboxPanel } from '../ui-components/checkbox-panel';

import { Dropdown } from '@nrwl/graph/ui-components';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { useCurrentPath } from '../hooks/use-current-path';
import { useRouteConstructor } from '../util';

function createTaskName(
  project: string,
  target: string,
  configuration?: string
) {
  if (configuration) {
    return `${project}:${target}:${configuration}`;
  } else {
    return `${project}:${target}`;
  }
}

export function TasksSidebar() {
  const graphService = getGraphService();
  const navigate = useNavigate();
  const params = useParams();

  const [searchParams, setSearchParams] = useSearchParams();
  const groupByProject = searchParams.get('groupByProject') === 'true';

  const selectedWorkspaceRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { targets: string[] };
  const workspaceLayout = selectedWorkspaceRouteData.layout;

  const routeData = useRouteLoaderData(
    'selectedTarget'
  ) as TaskGraphClientResponse;
  const { taskGraphs } = routeData;
  const { projects, targets } = selectedWorkspaceRouteData;
  const selectedTarget = params['selectedTarget'] ?? targets[0];

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const currentRoute = useCurrentPath();
  const routeContructor = useRouteConstructor();

  function selectTarget(target: string) {
    if (target === selectedTarget) return;

    hideAllProjects();

    if (params['selectedTarget']) {
      navigate({
        pathname: `../${encodeURIComponent(target)}`,
        search: searchParams.toString(),
      });
    } else {
      navigate({
        pathname: `${encodeURIComponent(target)}`,
        search: searchParams.toString(),
      });
    }
  }

  function toggleProject(project: string) {
    if (selectedProjects.includes(project)) {
      deselectProject(project);
    } else {
      selectProject(project);
    }
  }

  function selectProject(project: string) {
    setSelectedProjects([...selectedProjects, project]);

    const taskId = createTaskName(project, selectedTarget);

    graphService.handleTaskEvent({
      type: 'notifyTaskGraphTasksSelected',
      taskIds: [taskId],
    });
  }

  function selectAllProjects() {
    navigate(
      routeContructor(`/tasks/${encodeURIComponent(selectedTarget)}/all`, true)
    );
  }

  function hideAllProjects() {
    setSelectedProjects([]);

    const allProjects = projects.map(
      (project) => `${project.name}:${selectedTarget}`
    );

    graphService.handleTaskEvent({
      type: 'notifyTaskGraphTasksDeselected',
      taskIds: allProjects,
    });

    navigate(
      routeContructor(`/tasks/${encodeURIComponent(selectedTarget)}`, true)
    );
  }

  function deselectProject(project: string) {
    const newSelectedProjects = selectedProjects.filter(
      (selectedProject) => selectedProject !== project
    );
    setSelectedProjects(newSelectedProjects);

    const taskId = `${project}:${selectedTarget}`;

    graphService.handleTaskEvent({
      type: 'notifyTaskGraphTasksDeselected',
      taskIds: [taskId],
    });

    navigate(
      routeContructor(`/tasks/${encodeURIComponent(selectedTarget)}`, true)
    );
  }

  useEffect(() => {
    setSelectedProjects([]);
    graphService.handleTaskEvent({
      type: 'notifyTaskGraphSetProjects',
      projects: selectedWorkspaceRouteData.projects,
      taskGraphs,
    });
  }, [selectedWorkspaceRouteData]);

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

  useEffect(() => {
    switch (currentRoute.currentPath) {
      case `/tasks/${selectedTarget}/all`:
        const allProjectsWithSelectedTarget = projects.filter((project) =>
          project.data.targets.hasOwnProperty(selectedTarget)
        );

        setSelectedProjects(
          allProjectsWithSelectedTarget.map((project) => project.name)
        );

        graphService.handleTaskEvent({
          type: 'notifyTaskGraphTasksSelected',
          taskIds: allProjectsWithSelectedTarget.map(
            (project) => `${project.name}:${selectedTarget}`
          ),
        });
        break;
    }
  }, [currentRoute]);

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

  return (
    <>
      <ShowHideAll
        showAll={() => selectAllProjects()}
        hideAll={() => hideAllProjects()}
        showAffected={() => {}}
        hasAffected={false}
        label="tasks"
      ></ShowHideAll>

      <CheckboxPanel
        checked={groupByProject}
        checkChanged={groupByProjectChanged}
        name={'groupByProject'}
        label={'Group by project'}
        description={'Visually arrange tasks by project.'}
      />

      <TaskList
        projects={projects}
        selectedProjects={selectedProjects}
        workspaceLayout={workspaceLayout}
        selectedTarget={selectedTarget}
        toggleProject={toggleProject}
      >
        <label
          htmlFor="selectedTarget"
          className="my-2 block text-sm font-medium text-gray-700"
        >
          Target Name
        </label>
        <Dropdown
          id="selectedTarget"
          className="w-full"
          data-cy="selected-target-dropdown"
          defaultValue={selectedTarget}
          onChange={(event) => selectTarget(event.currentTarget.value)}
        >
          {targets.map((target) => (
            <option value={target}>{target}</option>
          ))}
        </Dropdown>
      </TaskList>
    </>
  );
}
