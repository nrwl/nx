import {
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { TaskList } from './task-list';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useEffect, useMemo } from 'react';
import { CheckboxPanel } from '../ui-components/checkbox-panel';
import { MultiSelect, MultiSelectOption, Spinner } from '@nx/graph-ui-common';
import {
  useRouteConstructor,
  type TaskGraphClientResponse,
} from '@nx/graph-shared';
import { useCurrentPath } from '../hooks/use-current-path';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { createTaskName } from '../util';
import { useTaskGraphContext } from '@nx/graph/tasks';

function TasksSidebarInner() {
  const { send } = useTaskGraphContext();
  const navigate = useNavigate();
  const createRoute = useRouteConstructor();

  const [searchParams, setSearchParams] = useSearchParams();
  const groupByProject = searchParams.get('groupByProject') === 'true';

  const selectedWorkspaceRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { targets: string[] };
  const workspaceLayout = selectedWorkspaceRouteData.layout;

  const allTasksRouteData = useRouteLoaderData(
    'allTasks'
  ) as TaskGraphClientResponse | null;

  const tasksRouteData = useRouteLoaderData(
    'tasks'
  ) as TaskGraphClientResponse | null;

  // Use tasks data if available, otherwise empty defaults
  const { taskGraph, error } = useMemo(() => {
    return (allTasksRouteData ||
      tasksRouteData || {
        taskGraph: {
          tasks: {},
          dependencies: {},
          continuousDependencies: {},
          roots: [],
        },
        error: null,
      }) as TaskGraphClientResponse;
  }, [tasksRouteData, allTasksRouteData]);
  let { projects, targets } = selectedWorkspaceRouteData;

  const selectedTargets = useMemo(() => {
    const targetsParam = searchParams.get('targets');
    return targetsParam ? targetsParam.split(' ').filter(Boolean) : [];
  }, [searchParams]);

  const currentRoute = useCurrentPath();
  const isAllRoute = currentRoute.currentPath === '/tasks/all';

  const allProjectsWithTargetsAndNoErrors = useMemo(
    () =>
      projects.filter(
        (project) =>
          selectedTargets.length > 0 &&
          selectedTargets.some((target) =>
            project.data.targets?.hasOwnProperty(target)
          ) &&
          !error // If there's a global error, exclude all projects
      ),
    [projects, selectedTargets, error]
  );

  const selectedProjects = useMemo(
    () =>
      isAllRoute
        ? allProjectsWithTargetsAndNoErrors.map(({ name }) => name)
        : searchParams.get('projects')?.split(' ') ?? [],
    [allProjectsWithTargetsAndNoErrors, searchParams, isAllRoute]
  );

  function updateSelectedTargets(newTargets: string[]) {
    hideAllProjects();
    const newParams = new URLSearchParams(searchParams);

    if (newTargets.length > 0) {
      newParams.set('targets', newTargets.join(' '));
    } else {
      newParams.delete('targets');
    }

    navigate(
      createRoute(
        { pathname: '/tasks', search: newParams.toString() },
        () => newParams
      )
    );
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
      newSelectedProjects.length === allProjectsWithTargetsAndNoErrors.length;

    const newParams = new URLSearchParams(searchParams);
    if (allProjectsSelected) {
      newParams.delete('projects');
    } else {
      newParams.set('projects', newSelectedProjects.join(' '));
    }

    navigate(
      createRoute(
        {
          pathname: allProjectsSelected ? '/tasks/all' : '/tasks',
          search: newParams.toString(),
        },
        () => newParams
      )
    );
  }

  function deselectProject(project: string) {
    const newSelectedProjects = selectedProjects.filter(
      (selectedProject) => selectedProject !== project
    );

    const newParams = new URLSearchParams(searchParams);
    if (newSelectedProjects.length === 0) {
      newParams.delete('projects');
    } else {
      newParams.set('projects', newSelectedProjects.join(' '));
    }

    navigate(
      createRoute(
        { pathname: '/tasks', search: newParams.toString() },
        () => newParams
      )
    );
  }

  function selectAllProjects() {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('projects');
    navigate(
      createRoute(
        { pathname: '/tasks/all', search: newParams.toString() },
        () => newParams
      )
    );
  }

  function hideAllProjects() {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('projects');
    navigate(
      createRoute(
        {
          pathname: '/tasks',
          search: newParams.toString(),
        },
        () => newParams
      )
    );
  }

  useEffect(() => {
    send({
      type: 'initGraph',
      projects: selectedWorkspaceRouteData.projects,
      taskGraph,
    });
  }, [selectedWorkspaceRouteData, send, taskGraph]);

  useEffect(() => {
    send({
      type: 'mergeGraph',
      projects: selectedWorkspaceRouteData.projects,
      taskGraph,
    });
  }, [selectedWorkspaceRouteData, taskGraph, isAllRoute, send]);

  useEffect(() => {
    send({ type: 'toggleGroupByProject', groupByProject });
  }, [groupByProject, send]);

  useEffect(() => {
    const taskIds = selectedProjects.flatMap((project) =>
      selectedTargets.map((target) => createTaskName(project, target))
    );

    send({ type: 'show', taskIds });
  }, [selectedProjects, selectedTargets, send]);

  function groupByProjectChanged(checked: boolean) {
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
        isShowingAll={isAllRoute}
      />

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
        selectedTargets={selectedTargets}
        toggleProject={toggleProject}
        error={error}
      >
        <label
          htmlFor="selectedTargets"
          className="my-2 block text-sm font-medium text-gray-700"
        >
          Target Names
        </label>
        <MultiSelect
          id="selectedTargets"
          className="w-full"
          options={targets.map(
            (target): MultiSelectOption => ({ value: target, label: target })
          )}
          value={selectedTargets}
          onChange={updateSelectedTargets}
          placeholder="Select targets..."
        />
      </TaskList>
    </>
  );
}

export function TasksSidebar() {
  const { graphClient } = useTaskGraphContext();

  if (!graphClient) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return <TasksSidebarInner />;
}
