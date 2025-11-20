/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  GraphError,
  ProjectGraphClientResponse,
  TaskGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
import type { ProjectGraphProjectNode } from '@nx/devkit';

/* eslint-enable @nx/enforce-module-boundaries */
import { useTaskGraphContext, NxGraphTaskGraphProvider } from '@nx/graph/tasks';
import {
  getExternalApiService,
  getProjectGraphDataService,
  useEnvironmentConfig,
  useRouteConstructor,
} from '@nx/graph-shared';
import { useRankDir, useTheme } from '@nx/graph-internal-ui-render-config';
import {
  useNavigate,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { ErrorToast } from '@nx/graph-ui-common';
import {
  NxGraphDebuggerPanel,
  NxGraphEmpty,
  NxGraphProjectListControl,
  NxGraphCustomProjectItem,
  NxGraphDropdownMultiselect,
  NxGraphTaskNodePanelContent,
  useElementPanel,
  NxGraphToolbar,
  NxGraphToolbarItemGroup,
  NxGraphThemeTool,
  NxGraphRankDirTool,
  NxGraphResetLayoutTool,
  NxGraphResetGraphTool,
  NxGraphShareTool,
  NxGraphGroupByProjectTool,
  NxGraphPanel,
  NxGraphElementPanel,
  NxGraphTaskNodePanelHeader,
} from '@nx/graph/ui';
import {
  ArrowLeftCircleIcon,
  DocumentMagnifyingGlassIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { useCurrentPath } from '../hooks/use-current-path';
import { createTaskName } from '../util';
import classNames from 'classnames';
import { ElementData, RenderPlatform } from '@nx/graph';
import { Tab, TabGroup, TabList } from '@headlessui/react';

export function TasksShell() {
  const environmentConfig = useEnvironmentConfig();

  const [errors, setErrors] = useState<GraphError[] | undefined>(undefined);

  const renderPlatform = useMemo(
    () =>
      environmentConfig.environment === 'nx-console' ? 'nx-console' : 'nx',
    [environmentConfig.environment]
  );

  const { errors: routerErrors } = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;

  useLayoutEffect(() => {
    setErrors(routerErrors);
  }, [routerErrors]);

  return (
    <>
      <NxGraphTaskGraphProvider renderPlatform={renderPlatform}>
        <TasksShellInner />
      </NxGraphTaskGraphProvider>
      <ErrorToast errors={errors} />
    </>
  );
}

function TasksShellInner() {
  const graphContext = useTaskGraphContext();
  const {
    containerRef,
    send,
    orchestrator,
    sendRendererConfigEvent,
    restoreGraphState,
    serializedGraphState,
    handleEventResult,
  } = graphContext;

  const navigate = useNavigate();
  const { currentPath } = useCurrentPath();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { rankDir, setRankDir } = useRankDir();
  const environmentConfig = useEnvironmentConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const createRoute = useRouteConstructor();
  const isAllRoute = useMemo(() => currentPath === '/tasks/all', [currentPath]);

  const selectedWorkspaceLoaderData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse & { targets: string[] };
  const tasksRouteData = useRouteLoaderData('tasks') as TaskGraphClientResponse;
  const allTasksRouteData = useRouteLoaderData(
    'tasksAll'
  ) as TaskGraphClientResponse;

  const tasksData = useMemo(() => {
    return allTasksRouteData || tasksRouteData;
  }, [allTasksRouteData, tasksRouteData]);

  const selectedTargets = useMemo(() => {
    const targetsParam = searchParams.get('targets');
    return targetsParam ? targetsParam.split(' ').filter(Boolean) : [];
  }, [searchParams]);

  const allProjectsWithTargetsAndNoErrors = useMemo(
    () =>
      selectedWorkspaceLoaderData.projects.filter(
        (project) =>
          selectedTargets.length > 0 &&
          selectedTargets.some((target) =>
            project.data.targets?.hasOwnProperty(target)
          ) &&
          !tasksData.error // If there's a global error, exclude all projects
      ),
    [selectedWorkspaceLoaderData.projects, selectedTargets, tasksData.error]
  );

  const selectedProjects = useMemo(
    () =>
      isAllRoute
        ? allProjectsWithTargetsAndNoErrors
        : selectedWorkspaceLoaderData.projects.filter((project) =>
            (searchParams.get('projects') ?? '')
              .split(' ')
              .includes(project.name)
          ),
    [allProjectsWithTargetsAndNoErrors, searchParams, isAllRoute]
  );

  const selectedProjectNames = useMemo(
    () => selectedProjects.map((project) => project.name),
    [selectedProjects]
  );

  const graphState = searchParams.get('graph');

  const [element] = useElementPanel<
    ElementData.TaskNode | ElementData.CompositeTaskNode
  >(orchestrator);

  useEffect(() => {
    if (!orchestrator) return;

    send({
      type: 'initGraph',
      projects: selectedWorkspaceLoaderData.projects,
      taskGraph: tasksData.taskGraph,
    });
  }, [orchestrator]);

  useEffect(() => {
    if (!orchestrator) return;

    send({
      type: 'mergeGraph',
      projects: selectedWorkspaceLoaderData.projects,
      taskGraph: tasksData.taskGraph,
    });
  }, [orchestrator, tasksData.taskGraph]);

  useEffect(() => {
    sendRendererConfigEvent({ type: 'themeChange', theme: resolvedTheme });
  }, [resolvedTheme]);

  useEffect(() => {
    sendRendererConfigEvent({ type: 'rankDirChange', rankDir });
  }, [rankDir]);

  useEffect(() => {
    if (!orchestrator) return;

    const taskIds = selectedProjects.flatMap((project) =>
      selectedTargets.map((target) => {
        const resolvedConfiguration =
          project.data.targets?.[target]?.defaultConfiguration;
        return createTaskName(project.name, target, resolvedConfiguration);
      })
    );

    send({ type: 'show', taskIds });
  }, [selectedProjects, selectedTargets, send, orchestrator]);

  useEffect(() => {
    if (!graphState || !orchestrator || graphState === serializedGraphState) {
      return;
    }

    const result = restoreGraphState(graphState);
    if (!result) return;

    if (result.rendererConfig.rankDir !== rankDir) {
      setRankDir(result.rendererConfig.rankDir);
    }

    if (result.rendererConfig.theme !== resolvedTheme) {
      setTheme(result.rendererConfig.theme);
    }
  }, [graphState, orchestrator]);

  useEffect(() => {
    setSearchParams(
      (params) => {
        const currentGraphParams = params.get('graph');

        // this means serialization went wrong
        if (serializedGraphState === null && currentGraphParams) {
          params.delete('graph');
          return params;
        }

        if (
          serializedGraphState &&
          currentGraphParams !== serializedGraphState
        ) {
          params.set('graph', serializedGraphState);
        }
        return params;
      },
      { preventScrollReset: true }
    );
  }, [serializedGraphState]);

  const onTargetsSelectionChange = (selectedIds: string[]) => {
    const newSearchParams = new URLSearchParams(searchParams);
    // remove selected projects when targets change
    newSearchParams.delete('projects');

    if (selectedIds.length > 0) {
      newSearchParams.set('targets', selectedIds.join(' '));
    } else {
      newSearchParams.delete('targets');
    }

    setSearchParams((prev) => {
      prev.delete('projects');
      if (selectedIds.length > 0) {
        prev.set('targets', selectedIds.join(' '));
      } else {
        prev.delete('targets');
      }
      return prev;
    });
  };

  const onToggleProject = (projectName: string, isSelected: boolean) => {
    if (isSelected) {
      const newSelectedProjects = selectedProjectNames.filter(
        (selectedProject) => selectedProject !== projectName
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
      return;
    }

    const newSelectedProjects = [...selectedProjectNames, projectName];
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
  };

  return (
    <div className="flex h-full w-full flex-col">
      {environmentConfig.appConfig.showDebugger ? (
        <NxGraphDebuggerPanel
          position="top"
          containerClassName="static bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-800"
          expandButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
          copyButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
          textareaClassName="bg-slate-50 dark:bg-slate-800"
        />
      ) : null}

      <div className="relative h-full w-full bg-white dark:bg-slate-900">
        <div
          ref={containerRef}
          className="h-full w-full bg-white dark:bg-slate-900"
          id="cytoscape-graph"
        ></div>

        <NxGraphToolbar toolbarClassName="border-slate-300 dark:border-slate-700 divide-slate-300 dark:divide-slate-700 z-50 divide-x">
          <NxGraphToolbarItemGroup className="pr-0">
            <NxGraphThemeTool
              theme={theme}
              setTheme={setTheme}
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
              toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
            />
            <NxGraphRankDirTool
              onRankDirChange={setRankDir}
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
              toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
            />
          </NxGraphToolbarItemGroup>
          <NxGraphToolbarItemGroup className="pl-2 pr-0">
            <NxGraphGroupByProjectTool
              toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolActiveClassName="bg-sky-500 dark:bg-sky-600 text-white dark:text-white"
            />
          </NxGraphToolbarItemGroup>
          <NxGraphToolbarItemGroup last className="pl-2">
            <NxGraphResetLayoutTool toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600" />
            <NxGraphResetGraphTool toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600" />
            <NxGraphShareTool
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
            />
          </NxGraphToolbarItemGroup>
        </NxGraphToolbar>

        <NxGraphEmpty className="z-30 flex items-center gap-2 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <ArrowLeftCircleIcon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          <h4 className="text-slate-700 dark:text-slate-300">
            No tasks found for the current graph configuration.
          </h4>
        </NxGraphEmpty>

        {handleEventResult.rendererConfig.platform === 'nx-console' ? (
          <TaskGraphControlsPanel
            targets={selectedWorkspaceLoaderData.targets}
            selectedTargets={selectedTargets}
            selectedProjects={selectedProjectNames}
            allProjects={allProjectsWithTargetsAndNoErrors}
            error={tasksData.error}
            onTargetsSelectionChange={onTargetsSelectionChange}
            onToggleProject={onToggleProject}
          />
        ) : (
          <div className="absolute bottom-0 left-0 top-4 z-50 flex flex-col">
            <TabGroup className="mb-2 ml-4 min-w-96 max-w-96">
              <TabList className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                <Tab
                  className={classNames(
                    'text-md flex-1 rounded-md px-3 py-1.5 font-medium transition-colors',
                    currentPath === '/projects'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                  )}
                  onClick={() => navigate('../projects')}
                >
                  Projects
                </Tab>
                <Tab
                  className={classNames(
                    'text-md flex-1 rounded-md px-3 py-1.5 font-medium transition-colors',
                    currentPath === '/tasks'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                  )}
                >
                  Tasks
                </Tab>
              </TabList>
            </TabGroup>
            <div className="relative flex-1">
              <TaskGraphControlsPanel
                closable={false}
                targets={selectedWorkspaceLoaderData.targets}
                selectedTargets={selectedTargets}
                selectedProjects={selectedProjectNames}
                allProjects={allProjectsWithTargetsAndNoErrors}
                error={tasksData.error}
                onTargetsSelectionChange={onTargetsSelectionChange}
                onToggleProject={onToggleProject}
              />
            </div>
          </div>
        )}

        <NxGraphElementPanel
          element={element}
          panelContainerClassName="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          panelHeaderClassName="border-slate-300 dark:border-slate-700"
          panelContentContainerClassName="divide-slate-300 dark:divide-slate-700"
          header={{
            task: (element, { open, close }) => (
              <NxGraphTaskNodePanelHeader
                element={element}
                open={open}
                close={close}
                elementNameClassName="text-slate-900 dark:text-slate-100"
                closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
                taskFlagBadgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
              />
            ),
          }}
        >
          {{
            task: (element) => (
              <TaskNodeDetails
                element={element}
                platform={handleEventResult.rendererConfig.platform}
              />
            ),
          }}
        </NxGraphElementPanel>
      </div>
    </div>
  );
}

interface TaskNodeDetailsProps {
  platform: RenderPlatform;
  element: ElementData.TaskNode;
}

function TaskNodeDetails({ element, platform }: TaskNodeDetailsProps) {
  const projectGraphDataService = getProjectGraphDataService();

  const externalApiService = getExternalApiService();
  const routeConstructor = useRouteConstructor();
  const navigate = useNavigate();

  const [inputs, setInputs] = useState<Record<string, string[]> | null>(null);
  const [isLoadingInputs, setIsLoadingInputs] = useState(true);

  useEffect(() => {
    // Only fetch if the service has the method
    if (!projectGraphDataService.getExpandedTaskInputs) return;

    projectGraphDataService
      .getExpandedTaskInputs(element.name)
      .then((expandedInputs) => {
        setInputs(expandedInputs);
      })
      .catch((error) => {
        console.error('Failed to fetch task inputs:', error);
      })
      .finally(() => {
        setIsLoadingInputs(false);
      });
  }, [element.name, projectGraphDataService]);

  const onViewProjectDetailsClick = () => {
    if (platform === 'nx-dev') return;
    const projectName = element.project.name;
    const targetName = element.task.target.target;

    if (platform === 'nx-console') {
      return externalApiService.postEvent({
        type: 'open-project-config',
        payload: { projectName, targetName },
      });
    }

    navigate(
      routeConstructor(
        {
          pathname: `/project-details/${encodeURIComponent(projectName)}`,
          search: `expanded=${targetName}`,
        },
        false
      )
    );
  };

  const onRunTaskClick = () => {
    if (platform !== 'nx-console') return;

    externalApiService.postEvent({
      type: 'run-task',
      payload: { taskId: element.id, takeName: element.name },
    });
  };

  return (
    <NxGraphTaskNodePanelContent
      element={element}
      inputs={inputs}
      isLoadingInputs={isLoadingInputs}
      sectionHeadingClassName="text-slate-900 dark:text-slate-100"
      sectionTextClassName="text-slate-700 dark:text-slate-300"
      actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
      sectionListContainerClassName="border-slate-200 dark:border-slate-700"
      sectionListSectionClassName="bg-slate-50 dark:bg-slate-800"
      sectionListHeaderClassName="text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800"
      sectionListHeaderLabelClassName="text-slate-600 dark:text-slate-400"
      sectionListItemsClassName="divide-slate-200 dark:divide-slate-600"
      sectionListItemClassName="bg-slate-50 dark:bg-slate-700"
      sectionListItemLabelClassName="text-slate-900 dark:text-slate-100"
      loadingSkeletonHeaderClassName="bg-slate-200 dark:bg-slate-600"
      loadingSkeletonItemClassName="bg-slate-100 dark:bg-slate-700"
      loadingSkeletonListClassName="bg-slate-50 dark:bg-slate-800"
    >
      {({ NxGraphActionButton }) => (
        <>
          <NxGraphActionButton onClick={onViewProjectDetailsClick}>
            <DocumentMagnifyingGlassIcon className="h-4 w-4" />
            <span className="text-sm">View in Project Details</span>
          </NxGraphActionButton>

          {platform === 'nx-console' ? (
            <NxGraphActionButton onClick={onRunTaskClick}>
              <PlayIcon className="h-4 w-4" />
              <span className="text-sm">Run task</span>
            </NxGraphActionButton>
          ) : null}
        </>
      )}
    </NxGraphTaskNodePanelContent>
  );
}

interface TaskGraphControlsPanelProps {
  targets: string[];
  selectedTargets: string[];
  selectedProjects: string[];

  allProjects: ProjectGraphProjectNode[];
  closable?: boolean;
  error?: string;

  onTargetsSelectionChange: (selectedIds: string[]) => void;
  onToggleProject: (projectName: string, isSelected: boolean) => void;
}

function TaskGraphControlsPanel({
  targets,
  selectedTargets,
  selectedProjects,
  closable = true,
  allProjects,
  error = '',
  onTargetsSelectionChange,
  onToggleProject,
}: TaskGraphControlsPanelProps) {
  return (
    <NxGraphPanel
      anchor="left"
      closable={closable}
      initialOpen
      panelContainerClassName="border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
      panelHeaderClassName="border-slate-300 dark:border-slate-700"
      panelCloseButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
      panelContentContainerClassName="divide-slate-300 dark:divide-slate-700"
      panelTriggerButtonClassName="border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      <NxGraphDropdownMultiselect
        items={targets.map((target) => ({ id: target, name: target }))}
        selectedIds={selectedTargets}
        onSelectionChange={onTargetsSelectionChange}
        containerClassName="bg-white dark:bg-slate-800"
        triggerClassName="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-600"
        triggerPlaceholderClassName="text-slate-500 dark:text-slate-400"
        triggerChevronClassName="text-slate-500 dark:text-slate-400"
        selectedChipClassName="bg-sky-100 dark:bg-sky-800 text-sky-900 dark:text-sky-100 border-sky-200 dark:border-sky-700"
        selectedCountClassName="text-slate-700 dark:text-slate-300"
        chipRemoveButtonClassName="text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-100"
        dropdownClassName="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
        dropdownContentClassName="bg-white dark:bg-slate-800"
        multiselectContainerClassName="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
        multiselectFilterInputClassName="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
        multiselectEmptyStateClassName="text-slate-500 dark:text-slate-400"
        multiselectListClassName="bg-white dark:bg-slate-800"
        multiselectListItemClassName="hover:bg-slate-50 dark:hover:bg-slate-700"
        multiselectCheckboxClassName="text-sky-600 dark:text-sky-400"
        multiselectLabelClassName="text-slate-900 dark:text-slate-100"
      />
      <NxGraphProjectListControl
        projects={allProjects.map((p) => ({
          type: p.type,
          id: p.data.name,
          name: p.data.name,
          selected: selectedProjects.includes(p.name),
          rendered: false,
          affected: false,
        }))}
        projectListEmptyClassName="text-slate-500 dark:text-slate-400"
        projectSectionHeaderClassName="text-slate-700 dark:text-slate-300"
        searchInputClassName="bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
      >
        {(props) => (
          <NxGraphCustomProjectItem
            project={props.project}
            error={error}
            onToggle={() => {
              onToggleProject(props.project.name, props.project.selected);
            }}
            projectItemClassName={({ selected }) =>
              classNames(
                'hover:bg-slate-100 dark:hover:bg-slate-700',
                selected ? 'opacity-100' : 'opacity-70'
              )
            }
            projectNameClassName="text-slate-900 dark:text-slate-100 dark:hover:bg-slate-700"
          />
        )}
      </NxGraphProjectListControl>
    </NxGraphPanel>
  );
}
