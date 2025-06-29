import {
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { TaskList } from './task-list';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useEffect, useMemo } from 'react';
import { getGraphService } from '../machines/graph.service';
import { CheckboxPanel } from '../ui-components/checkbox-panel';
import { Dropdown } from '@nx/graph/legacy/components';
import { useRouteConstructor } from '@nx/graph/legacy/shared';
import { useCurrentPath } from '../hooks/use-current-path';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { useTaskGraphLazyLoading } from '../hooks/use-task-graph-lazy-loading';
import { createTaskName } from '../util';

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

  // Use the new lazy loading hook
  const {
    taskGraphs: lazyTaskGraphs,
    loadTaskGraph,
    errors: lazyErrors,
    metadata,
    hasTaskGraph,
    isTaskLoading,
  } = useTaskGraphLazyLoading(params.selectedWorkspaceId || '', routeData);

  // Merge legacy and lazy loaded data
  const taskGraphs = { ...(routeData.taskGraphs || {}), ...lazyTaskGraphs };
  const errors = { ...(routeData.errors || {}), ...lazyErrors };

  let { projects, targets } = selectedWorkspaceRouteData;

  // If we have metadata, use it to build the targets list more efficiently
  if (metadata?.projects) {
    const allTargets = new Set<string>();
    metadata.projects.forEach((project) => {
      if (project.targets) {
        project.targets.forEach((target) => {
          allTargets.add(target.name);
        });
      }
    });
    targets = Array.from(allTargets).sort();
  }

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

  // Lazy load task graphs for selected projects
  useEffect(() => {
    const loadTaskGraphs = async () => {
      for (const projectName of selectedProjects) {
        if (
          !hasTaskGraph(projectName, selectedTarget) &&
          !isTaskLoading(projectName, selectedTarget)
        ) {
          await loadTaskGraph(projectName, selectedTarget);
        }
      }
    };

    loadTaskGraphs();
  }, [
    selectedProjects,
    selectedTarget,
    hasTaskGraph,
    isTaskLoading,
    loadTaskGraph,
  ]);

  useEffect(() => {
    // Notify the graph service about selected tasks
    // Ensure we have placeholder task graphs for any missing ones to prevent errors
    const taskIds = selectedProjects.map((p) =>
      createTaskName(p, selectedTarget)
    );

    // Create empty placeholder task graphs for tasks that haven't loaded yet
    const allTaskGraphs = {
      ...(routeData.taskGraphs || {}),
      ...lazyTaskGraphs,
    };
    taskIds.forEach((taskId) => {
      if (!allTaskGraphs[taskId]) {
        allTaskGraphs[taskId] = {
          tasks: {},
          dependencies: {},
          continuousDependencies: {},
          roots: [],
        };
      }
    });

    // Update the graph service with complete task graphs including placeholders
    graphService.handleTaskEvent({
      type: 'notifyTaskGraphSetProjects',
      projects: selectedWorkspaceRouteData.projects,
      taskGraphs: allTaskGraphs,
    });

    graphService.handleTaskEvent({
      type: 'notifyTaskGraphSetTasks',
      taskIds: taskIds,
    });
  }, [
    graphService,
    selectedProjects,
    selectedTarget,
    lazyTaskGraphs,
    routeData.taskGraphs,
    selectedWorkspaceRouteData.projects,
  ]);

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
        isTaskLoading={isTaskLoading}
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
