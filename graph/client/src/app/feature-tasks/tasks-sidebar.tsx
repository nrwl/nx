import { TaskList } from './task-list';
import {
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { getGraphService } from '../machines/graph.service';
import { useEffect, useMemo } from 'react';
import { CheckboxPanel } from '../ui-components/checkbox-panel';

import { Dropdown } from '@nx/graph/ui-components';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { useCurrentPath } from '../hooks/use-current-path';
import { createTaskName, useRouteConstructor } from '../util';

export function TasksSidebar() {
  const graphService = getGraphService();
  const navigate = useNavigate();
  const params = useParams();
  const createRoute = useRouteConstructor();

  const [searchParams, setSearchParams] = useSearchParams();
  const groupByProject = searchParams.get('groupByProject') === 'true';

  const selectedWorkspaceRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { targets: string[] };
  const workspaceLayout = selectedWorkspaceRouteData.layout;

  const routeData = useRouteLoaderData(
    'selectedTarget'
  ) as TaskGraphClientResponse;
  const { taskGraphs, errors } = routeData;
  let { projects, targets } = selectedWorkspaceRouteData;

  const selectedTarget = params['selectedTarget'] ?? targets[0];

  const currentRoute = useCurrentPath();
  const isAllRoute =
    currentRoute.currentPath === `/tasks/${selectedTarget}/all`;

  const allProjectsWithTargetAndNoErrors = projects.filter(
    (project) =>
      project.data.targets?.hasOwnProperty(selectedTarget) &&
      !errors?.hasOwnProperty(createTaskName(project.name, selectedTarget))
  );

  const selectedProjects = useMemo(
    () =>
      isAllRoute
        ? allProjectsWithTargetAndNoErrors.map(({ name }) => name)
        : searchParams.get('projects')?.split(' ') ?? [],
    [allProjectsWithTargetAndNoErrors, searchParams, isAllRoute]
  );

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
    const newSelectedProjects = [...selectedProjects, project];
    const allProjectsSelected =
      newSelectedProjects.length === allProjectsWithTargetAndNoErrors.length;
    if (allProjectsSelected) {
      searchParams.delete('projects');
    } else {
      searchParams.set('projects', newSelectedProjects.join(' '));
    }

    navigate(
      createRoute(
        {
          pathname: allProjectsSelected
            ? `/tasks/${encodeURIComponent(selectedTarget)}/all`
            : `/tasks/${encodeURIComponent(selectedTarget)}`,
          search: searchParams.toString(),
        },
        false
      )
    );
  }

  function deselectProject(project: string) {
    const newSelectedProjects = selectedProjects.filter(
      (selectedProject) => selectedProject !== project
    );
    if (newSelectedProjects.length === 0) {
      searchParams.delete('projects');
    } else {
      searchParams.set('projects', newSelectedProjects.join(' '));
    }
    navigate(
      createRoute(
        {
          pathname: `/tasks/${encodeURIComponent(selectedTarget)}`,
          search: searchParams.toString(),
        },
        false
      )
    );
  }

  function selectAllProjects() {
    searchParams.delete('projects');
    navigate(
      createRoute(
        {
          pathname: `/tasks/${encodeURIComponent(selectedTarget)}/all`,
          search: searchParams.toString(),
        },
        false
      )
    );
  }

  function hideAllProjects() {
    searchParams.delete('projects');
    navigate(
      createRoute(
        {
          pathname: `/tasks/${encodeURIComponent(selectedTarget)}`,
          search: searchParams.toString(),
        },
        false
      )
    );
  }

  useEffect(() => {
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
    graphService.handleTaskEvent({
      type: 'notifyTaskGraphSetTasks',
      taskIds: selectedProjects.map((p) => createTaskName(p, selectedTarget)),
    });
  }, [graphService, selectedProjects, selectedTarget]);

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
        errors={errors}
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
            <option key={target} value={target}>
              {target}
            </option>
          ))}
        </Dropdown>
      </TaskList>
    </>
  );
}
