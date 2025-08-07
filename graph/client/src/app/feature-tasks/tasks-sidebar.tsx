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
  TaskGraphMetadata,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { CheckboxPanel } from '../ui-components/checkbox-panel';
import { Dropdown, Spinner } from '@nx/graph-ui-common';
import {
  useRouteConstructor,
  getProjectGraphDataService,
  getEnvironmentConfig,
} from '@nx/graph-shared';
import { useCurrentPath } from '../hooks/use-current-path';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { createTaskName } from '../util';
import { useTaskGraphContext } from '@nx/graph/tasks';

const projectGraphDataService = getProjectGraphDataService();
const { appConfig } = getEnvironmentConfig();

function TasksSidebarInner() {
  const { send } = useTaskGraphContext();
  const navigate = useNavigate();
  const params = useParams();
  const createRoute = useRouteConstructor();

  const [searchParams, setSearchParams] = useSearchParams();
  const groupByProject = searchParams.get('groupByProject') === 'true';

  const selectedWorkspaceRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { targets: string[] };
  const workspaceLayout = selectedWorkspaceRouteData.layout;

  const tasksRouteData = useRouteLoaderData(
    'tasks'
  ) as TaskGraphClientResponse & { metadata?: TaskGraphMetadata };
  const selectedTargetRouteData = useRouteLoaderData('selectedTarget') as
    | (TaskGraphClientResponse & { metadata?: TaskGraphMetadata })
    | null;

  // Use selectedTarget data if available, otherwise fall back to tasks data
  const activeRouteData = selectedTargetRouteData || tasksRouteData;

  const {
    taskGraphs: initialTaskGraphs,
    errors: initialErrors,
    metadata,
  } = activeRouteData;
  let { projects, targets } = selectedWorkspaceRouteData;

  // State to track loaded task graphs and errors
  const [taskGraphs, setTaskGraphs] = useState(initialTaskGraphs || {});
  const [errors, setErrors] = useState(initialErrors || {});
  const [loadingProjects, setLoadingProjects] = useState<Set<string>>(
    new Set()
  );

  const selectedTarget = useMemo(
    () => params['selectedTarget'] ?? targets[0],
    [params['selectedTarget'], targets]
  );

  const currentRoute = useCurrentPath();
  const isAllRoute =
    currentRoute.currentPath === `/tasks/${selectedTarget}/all`;

  const allProjectsWithTargetAndNoErrors = useMemo(
    () =>
      projects.filter(
        (project) =>
          project.data.targets?.hasOwnProperty(selectedTarget) &&
          !errors?.hasOwnProperty(createTaskName(project.name, selectedTarget))
      ),
    [projects, selectedTarget, errors]
  );

  const selectedProjects = useMemo(
    () =>
      isAllRoute
        ? allProjectsWithTargetAndNoErrors.map(({ name }) => name)
        : searchParams.get('projects')?.split(' ') ?? [],
    [allProjectsWithTargetAndNoErrors, searchParams, isAllRoute]
  );

  // // Function to load specific task graph for a project
  // const loadTaskGraphForProject = useCallback(
  //   async (projectName: string) => {
  //     if (!projectGraphDataService.getSpecificTaskGraph || !metadata) {
  //       return; // Fallback to existing behavior
  //     }
  //
  //     const taskId = createTaskName(projectName, selectedTarget);
  //
  //     // Check if already loaded or loading
  //     if (taskGraphs[taskId] || loadingProjects.has(projectName)) {
  //       return;
  //     }
  //
  //     setLoadingProjects((prev) => new Set(prev).add(projectName));
  //
  //     try {
  //       const workspaceInfo = params.selectedWorkspaceId
  //         ? appConfig.workspaces.find(
  //             (w) => w.id === params.selectedWorkspaceId
  //           )
  //         : appConfig.workspaces.find(
  //             (w) => w.id === appConfig.defaultWorkspaceId
  //           );
  //
  //       if (!workspaceInfo) return;
  //
  //       const response = await projectGraphDataService.getSpecificTaskGraph(
  //         workspaceInfo.taskGraphUrl,
  //         projectName,
  //         selectedTarget,
  //         undefined // configuration can be added later if needed
  //       );
  //
  //       setTaskGraphs((prev) => ({
  //         ...prev,
  //         ...response.taskGraphs,
  //       }));
  //
  //       setErrors((prev) => ({
  //         ...prev,
  //         ...response.errors,
  //       }));
  //     } catch (error) {
  //       console.error(`Failed to load task graph for ${projectName}:`, error);
  //       setErrors((prev) => ({
  //         ...prev,
  //         [taskId]: `Failed to load task graph: ${error.message}`,
  //       }));
  //     } finally {
  //       setLoadingProjects((prev) => {
  //         const next = new Set(prev);
  //         next.delete(projectName);
  //         return next;
  //       });
  //     }
  //   },
  //   [
  //     selectedTarget,
  //     metadata,
  //     taskGraphs,
  //     loadingProjects,
  //     params.selectedWorkspaceId,
  //   ]
  // );

  function selectTarget(target: string) {
    if (target === selectedTarget) return;
    hideAllProjects();
    navigate({
      pathname: `../${encodeURIComponent(target)}`,
      search: searchParams.toString(),
    });
  }

  function toggleProject(project: string) {
    if (selectedProjects.includes(project)) {
      deselectProject(project);
    } else {
      selectProject(project);
    }
  }

  function selectProject(project: string) {
    // // Load task graph for this project if using lazy loading
    // if (metadata) {
    //   loadTaskGraphForProject(project);
    // }

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
    // Load all task graphs if using lazy loading
    // if (metadata) {
    //   allProjectsWithTargetAndNoErrors.forEach((project) =>
    //     loadTaskGraphForProject(project.name)
    //   );
    // }

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
    send({
      type: 'initGraph',
      projects: selectedWorkspaceRouteData.projects,
      taskGraphs,
    });
  }, [selectedWorkspaceRouteData]);

  useEffect(() => {
    send({ type: 'toggleGroupByProject', groupByProject });
  }, [searchParams]);

  useEffect(() => {
    // Load task graphs for selected projects if using lazy loading
    // if (metadata && selectedProjects.length > 0) {
    //   selectedProjects.forEach((project) => loadTaskGraphForProject(project));
    // }

    send({
      type: 'show',
      taskIds: selectedProjects.map((p) => createTaskName(p, selectedTarget)),
    });
  }, [selectedProjects, selectedTarget, metadata]);

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
