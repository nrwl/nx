/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type {
  GraphError,
  ProjectGraphClientResponse,
} from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */

import {
  ArrowDownTrayIcon,
  ArrowLeftCircleIcon,
  InformationCircleIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import {
  fetchProjectGraph,
  getExternalApiService,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
  useRouteConstructor,
} from '@nx/graph-shared';
import { Tooltip, ErrorToast, Dropdown } from '@nx/graph-ui-common';
import { ThemePanel, useTheme } from '@nx/graph-internal-ui-theme';
import classNames from 'classnames';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  Outlet,
  useNavigate,
  useNavigation,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom';
import { RankdirPanel } from './feature-projects/panels/rankdir-panel';
import { useCurrentPath } from './hooks/use-current-path';
import { getProjectGraphService } from './machines/get-services';
import { DebuggerPanel } from './ui-components/debugger-panel';
import { ExperimentalFeature } from './ui-components/experimental-feature';
import {
  NxGraphProjectGraphProvider,
  useProjectGraphContext,
} from '@nx/graph/projects';
import { NxGraphTaskGraphProvider, useTaskGraphContext } from '@nx/graph/tasks';
import { NxGraphEmpty } from '@nx/graph/ui';
import {
  NxGraphPalette,
  ProjectNodeElementData,
  RenderRankDir,
  switchValueByDarkMode,
  TaskNodeElementData,
  useRenderGraphEvents,
} from '@nx/graph';
import {
  NxGraphContextMenu,
  useGraphContextMenu,
} from '@nx/graph/context-menu';
import {
  NodeSelectionDialog,
  NxGraphDialog,
  useCompositeNodeSelection,
  CompositeNodeSelectionProvider,
} from '@nx/graph/dialogs';
import { ProjectEdgeContextMenu } from './ui-context-menus/project-edge-context-menu';
import { CompositeProjectEdgeContextMenu } from './ui-context-menus/composite-project-edge-context-menu';
import { ProjectNodeContextMenu } from './ui-context-menus/project-node-context-menu';
import { CompositeProjectNodeContextMenu } from './ui-context-menus/composite-project-node-context-menu';
import { TaskNodeContextMenu } from './ui-context-menus/task-node-context-menu';

function useGraphContextFactory(topLevelRoute: string) {
  return useMemo(() => {
    return topLevelRoute.includes('/projects')
      ? useProjectGraphContext
      : useTaskGraphContext;
  }, [topLevelRoute]);
}

const routes = [
  { route: '/projects', label: 'Projects' },
  { route: '/tasks', label: 'Tasks' },
];

export function Shell(): JSX.Element {
  const { environment } = useEnvironmentConfig();
  const currentPath = useCurrentPath();
  const currentRoute = currentPath.currentPath;

  const topLevelRoute = useMemo(
    () => (currentRoute.startsWith('/tasks') ? '/tasks' : '/projects'),
    [currentRoute]
  );

  const renderPlatform = useMemo(
    () => (environment === 'nx-console' ? 'nx-console' : 'nx'),
    [environment]
  );

  if (topLevelRoute.includes('projects')) {
    return (
      <NxGraphProjectGraphProvider
        renderPlatform={renderPlatform}
        styles={({ isComposite }) =>
          isComposite
            ? [
                {
                  selector: 'node.affected',
                  style: {
                    color: (node) =>
                      switchValueByDarkMode(
                        node,
                        NxGraphPalette.zinc_100,
                        NxGraphPalette.zinc_800
                      ),
                    'border-color': (node) =>
                      switchValueByDarkMode(
                        node,
                        NxGraphPalette.fuchsia_800,
                        NxGraphPalette.pink_500
                      ),
                    backgroundColor: (node) =>
                      switchValueByDarkMode(
                        node,
                        NxGraphPalette.fuchsia_700,
                        NxGraphPalette.pink_400
                      ),
                  },
                },
              ]
            : []
        }
      >
        <InnerShell
          topLevelRoute={topLevelRoute}
          workspace={currentPath.workspace}
        />
      </NxGraphProjectGraphProvider>
    );
  }

  return (
    <NxGraphTaskGraphProvider renderPlatform={renderPlatform} styles={[]}>
      <InnerShell
        topLevelRoute={topLevelRoute}
        workspace={currentPath.workspace}
      />
    </NxGraphTaskGraphProvider>
  );
}

function InnerShell({
  topLevelRoute,
  workspace,
}: {
  topLevelRoute: string;
  workspace: string;
}) {
  const projectGraphService = getProjectGraphService();
  const projectGraphDataService = getProjectGraphDataService();
  const externalApiService = getExternalApiService();

  const { resolvedTheme } = useTheme();
  const routeConstructor = useRouteConstructor();
  const environmentConfig = useEnvironmentConfig();
  const navigate = useNavigate();
  const { state: navigationState } = useNavigation();
  const params = useParams();

  const [errors, setErrors] = useState<GraphError[] | undefined>(undefined);
  const { errors: routerErrors } = useRouteLoaderData('selectedWorkspace') as {
    errors: GraphError[];
  };
  useLayoutEffect(() => {
    setErrors(routerErrors);
  }, [routerErrors]);

  usePoll(
    async () => {
      const response: ProjectGraphClientResponse = await fetchProjectGraph(
        projectGraphDataService,
        params,
        environmentConfig.appConfig
      );
      setErrors(response.errors);
    },
    1000,
    environmentConfig.watch
  );

  const {
    containerRef,
    sendRenderConfigEvent,
    handleEventResult,
    graphClient,
  } = useGraphContextFactory(topLevelRoute)();

  const { graphMenu, closeMenu } = useGraphContextMenu({
    renderGraphEventBus: graphClient,
    closeOn: [],
  });

  const {
    nodeSelectionDialog,
    handleCompositeNodeExpand,
    handleChangeSelection,
    handleDialogConfirm,
    handleDialogCancel,
  } = useCompositeNodeSelection({
    onExpand: (
      compositeNodeId,
      selectedNodeIds,
      isChangingSelection = false
    ) => {
      projectGraphService.send({
        type: 'expandCompositeNode',
        compositeNodeId,
        selectedNodeIds,
        changingSelection: isChangingSelection,
      });
    },
  });

  useRenderGraphEvents(graphClient, {
    CompositeNodeDblClick: ({ data, isExpanded }) => {
      if (isExpanded) {
        projectGraphService.send({
          type: 'collapseCompositeNode',
          compositeNodeId: data.id,
        });
      } else {
        handleCompositeNodeExpand(data);
      }
    },
  });

  useEffect(() => {
    sendRenderConfigEvent({ type: 'ThemeChange', theme: resolvedTheme });
  }, [resolvedTheme]);

  const nodesVisible = useMemo(() => {
    let count = 0;

    if (handleEventResult.type === 'tasks') {
      count = handleEventResult.tasks.length;
    } else {
      count =
        handleEventResult.projects.length + handleEventResult.composites.length;
    }

    return count > 0;
  }, [handleEventResult]);

  function onRankDirChange(rankDir: RenderRankDir) {
    sendRenderConfigEvent({ type: 'RankDirChange', rankDir });
  }

  function projectChange(projectGraphId: string) {
    navigate(`/${encodeURIComponent(projectGraphId)}${topLevelRoute}`);
  }

  function downloadImage() {
    const data = graphClient.getImage();

    let downloadLink = document.createElement('a');
    downloadLink.href = data;
    downloadLink.download = 'graph.png';
    // this is necessary as link.click() does not work on the latest firefox
    downloadLink.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      })
    );
  }

  function resetLayout() {
    sendRenderConfigEvent({ type: 'ResetLayout' });
  }

  function onProjectConfigClick(projectNodeData: ProjectNodeElementData) {
    const renderPlatform =
      graphClient.graphState.renderScratchData.renderPlatform;
    if (renderPlatform === 'nx-dev') return () => {};

    if (renderPlatform === 'nx-console') {
      return () => {
        closeMenu();
        return externalApiService.postEvent({
          type: 'open-project-config',
          payload: {
            projectName: projectNodeData.name,
            projectId: projectNodeData.id,
          },
        });
      };
    }

    return () => {
      closeMenu();
      return navigate(
        routeConstructor(
          {
            pathname: `/project-details/${encodeURIComponent(
              projectNodeData.name
            )}`,
          },
          false
        )
      );
    };
  }

  function onTaskConfigClick(taskNodeData: TaskNodeElementData) {
    const renderPlatform =
      graphClient.graphState.renderScratchData.renderPlatform;
    if (renderPlatform === 'nx-dev') return () => {};

    const [projectName, targetName] = taskNodeData.name.split(':');

    if (renderPlatform === 'nx-console') {
      return () =>
        externalApiService.postEvent({
          type: 'open-project-config',
          payload: { projectName, targetName },
        });
    }

    return () => {
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
  }

  function onRunTaskClick(taskNodeData: TaskNodeElementData) {
    const renderPlatform =
      graphClient.graphState.renderScratchData.renderPlatform;
    if (renderPlatform !== 'nx-console') return () => {};

    return () => {
      externalApiService.postEvent({
        type: 'run-task',
        payload: {
          taskId: taskNodeData.id,
          taskName: taskNodeData.name,
        },
      });
    };
  }

  return (
    <CompositeNodeSelectionProvider
      value={{
        nodeSelectionDialog,
        handleCompositeNodeExpand,
        handleChangeSelection,
        handleDialogConfirm,
        handleDialogCancel,
      }}
    >
      <div className="flex h-screen w-screen">
        <div
          className={`${
            environmentConfig.environment === 'nx-console'
              ? 'absolute left-5 top-5 z-50 bg-white'
              : 'relative flex h-full overflow-y-scroll'
          } w-72 flex-col pb-10 shadow-lg ring-1 ring-slate-900/10 ring-opacity-10 transition-all dark:ring-slate-300/10`}
          id="sidebar"
        >
          {environmentConfig.environment !== 'nx-console' ? (
            <>
              <div className="border-b border-slate-900/10 text-slate-700 dark:border-slate-300/10 dark:bg-transparent dark:text-slate-400">
                <div className="mx-4 my-2 flex items-center justify-between">
                  <svg
                    className="h-10 w-auto text-slate-900 dark:text-white"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>Nx</title>
                    <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
                  </svg>
                  <Dropdown
                    data-cy="route-select"
                    defaultValue={topLevelRoute}
                    onChange={(event) => {
                      if (topLevelRoute === '/projects') {
                        projectGraphService.send('deselectAll');
                      }

                      if (environmentConfig.environment === 'dev') {
                        navigate(
                          `/${encodeURIComponent(workspace)}${
                            event.currentTarget.value
                          }`
                        );
                      } else {
                        navigate(`${event.currentTarget.value}`);
                      }
                    }}
                  >
                    {routes.map((route) => (
                      <option key={route.label} value={route.route}>
                        {route.label}
                      </option>
                    ))}
                  </Dropdown>

                  <ExperimentalFeature>
                    <RankdirPanel onRankDirChange={onRankDirChange} />
                  </ExperimentalFeature>

                  <ThemePanel />
                </div>
              </div>

              <a
                id="help"
                className="
                mt-3
                flex cursor-pointer
                items-center
                px-4
                text-xs
                hover:underline
              "
                href="https://nx.dev/structure/dependency-graph"
                rel="noreferrer"
                target="_blank"
              >
                <InformationCircleIcon className="mr-2 h-4 w-4" />
                Analyse and visualize your workspace.
              </a>
            </>
          ) : null}
          <Outlet />
        </div>
        <div
          id="main-content"
          className="flex flex-1 flex-col overflow-hidden transition-all"
        >
          {environmentConfig.appConfig.showDebugger ? (
            <DebuggerPanel
              projects={environmentConfig.appConfig.workspaces}
              selectedProject={params.selectedWorkspaceId}
              graphEventResult={handleEventResult}
              selectedProjectChange={projectChange}
            />
          ) : null}

          <div className="relative h-full w-full">
            <div
              ref={containerRef}
              className="h-full w-full cursor-pointer"
              id="cytoscape-graph"
            ></div>

            {!nodesVisible || navigationState === 'loading' ? (
              <NxGraphEmpty>
                <ArrowLeftCircleIcon className="mr-4 h-6 w-6" />
                <h4>
                  Please select a{' '}
                  {topLevelRoute.includes('tasks') ? 'task' : 'project'} in the
                  sidebar.
                </h4>
              </NxGraphEmpty>
            ) : null}

            {graphMenu ? (
              <NxGraphContextMenu
                menu={graphMenu.props}
                virtualElement={graphMenu.virtualElement}
                placement="bottom-start"
                menuItemsContainerClassName="dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200"
              >
                {{
                  // TODO: (chau) refactor this for graph consistency CLOUD-3443
                  project: ({ data }) => (
                    <ProjectNodeContextMenu
                      data={data}
                      renderPlatform={
                        graphClient.graphState.renderScratchData.renderPlatform
                      }
                      onConfigClick={onProjectConfigClick(data)}
                      tracingStart={
                        projectGraphService.getSnapshot().context.tracing.start
                      }
                      onAction={(action) => {
                        if (action.type === 'focus-node') {
                          navigate(
                            routeConstructor(`/projects/${data.name}`, true)
                          );
                          return;
                        }

                        if (action.type === 'exclude-node') {
                          projectGraphService.send({
                            type: 'excludeNode',
                            nodeIds: [data.id],
                          });
                          return;
                        }

                        if (action.type === 'start-trace') {
                          navigate(
                            routeConstructor(
                              `/projects/trace/${data.name}`,
                              (searchParams) => {
                                // when we start tracing, we will get out of composite mode
                                if (searchParams.has('composite')) {
                                  searchParams.delete('composite');
                                }
                                return searchParams;
                              }
                            )
                          );
                          closeMenu();
                          return;
                        }

                        if (action.type === 'end-trace') {
                          const start =
                            projectGraphService.getSnapshot().context.tracing
                              .start;
                          if (!start) return;
                          navigate(
                            routeConstructor(
                              `/projects/trace/${start}/${data.name}`,
                              true
                            )
                          );
                          closeMenu();
                          return;
                        }
                      }}
                    />
                  ),
                  compositeProject: ({ data, isExpanded }) => (
                    <CompositeProjectNodeContextMenu
                      data={data}
                      isExpanded={isExpanded}
                      onAction={(action) => {
                        if (action.type === 'expand-node') {
                          handleCompositeNodeExpand(data);
                          return;
                        }

                        if (action.type === 'collapse-node') {
                          projectGraphService.send({
                            type: 'collapseCompositeNode',
                            compositeNodeId: data.id,
                          });
                          return;
                        }

                        if (action.type === 'change-selection') {
                          handleChangeSelection(data);
                          return;
                        }

                        if (action.type === 'exclude-node') {
                          projectGraphService.send({
                            type: 'excludeNode',
                            nodeIds: [data.id],
                          });
                          return;
                        }
                      }}
                    />
                  ),
                  task: ({ data }) => (
                    <TaskNodeContextMenu
                      data={data}
                      renderPlatform={
                        graphClient.graphState.renderScratchData.renderPlatform
                      }
                      onConfigClick={onTaskConfigClick(data)}
                      onRunTaskClick={onRunTaskClick(data)}
                    />
                  ),
                  projectEdge: ({ data }) => (
                    <ProjectEdgeContextMenu data={data} />
                  ),
                  compositeProjectEdge: ({ data }) => (
                    <CompositeProjectEdgeContextMenu data={data} />
                  ),
                }}
              </NxGraphContextMenu>
            ) : null}

            {nodeSelectionDialog.isOpen &&
              nodeSelectionDialog.compositeNodeData && (
                <NxGraphDialog
                  activeDialog={{
                    title: 'Select Nodes to Expand',
                    icon: null,
                    dialog: (
                      <NodeSelectionDialog
                        name={nodeSelectionDialog.compositeNodeData.name}
                        projectNodes={
                          nodeSelectionDialog.compositeNodeData.projects
                        }
                        compositeProjectNodes={
                          nodeSelectionDialog.compositeNodeData.composites
                        }
                        lastSelectedNodeIds={
                          nodeSelectionDialog.compositeNodeData
                            .lastSelectedNodeIds
                        }
                        onConfirm={handleDialogConfirm}
                        onCancel={handleDialogCancel}
                        classNames={{
                          container: 'dark:bg-slate-800 dark:text-slate-200',
                          header: 'dark:text-white',
                          searchInput:
                            'dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:placeholder-slate-400 dark:focus:ring-sky-500',
                          checkbox:
                            'dark:border-slate-500 dark:bg-slate-700 data-checked:bg-blue-500 data-checked:border-blue-500 dark:data-checked:bg-sky-500 dark:data-checked:border-sky-500',
                          label: 'dark:text-slate-300',
                          selectedCount: 'dark:text-slate-400',
                          primaryButton:
                            'dark:bg-sky-600 dark:hover:bg-sky-700 dark:disabled:bg-slate-600',
                          secondaryButton:
                            'dark:bg-slate-700 dark:hover:bg-slate-600 dark:border-slate-600 dark:text-slate-200',
                          scrollArea: 'dark:border-slate-700 dark:bg-slate-900',
                          sectionTitle: 'dark:text-slate-300',
                          nodeLabel: 'dark:text-slate-200',
                          affectedBadge: 'dark:bg-blue-900 dark:text-blue-200',
                          emptyState: 'dark:text-slate-400',
                          actionBar: 'dark:bg-slate-800',
                        }}
                      />
                    ),
                    dialogContainerClassName: 'dark:bg-slate-800',
                  }}
                  onClose={handleDialogCancel}
                  className="dark:bg-slate-900/50"
                />
              )}

            <Tooltip
              openAction="hover"
              content="Download Graph as PNG"
              placement="left"
            >
              <button
                type="button"
                className={classNames(
                  !nodesVisible ? 'invisible opacity-0' : '',
                  'fixed bottom-4 right-4 z-50 block h-12 w-12 transform rounded-full bg-blue-500 text-white shadow-sm transition duration-300 dark:bg-sky-500'
                )}
                data-cy="downloadImageButton"
                onClick={downloadImage}
              >
                <ArrowDownTrayIcon className="absolute left-1/2 top-1/2 -ml-3 -mt-3 h-6 w-6" />
              </button>
            </Tooltip>

            <button
              type="button"
              className={classNames(
                !nodesVisible ? 'invisible opacity-0' : '',
                'fixed bottom-20 right-4 z-50 block h-12 w-12 transform rounded-full bg-blue-500 text-white shadow-sm transition duration-300 dark:bg-sky-500'
              )}
              data-cy="resetLayoutButton"
              onClick={resetLayout}
            >
              <ViewfinderCircleIcon className="absolute left-1/2 top-1/2 -ml-3 -mt-3 h-6 w-6" />
            </button>
          </div>
        </div>
        <ErrorToast errors={errors} />
      </div>
    </CompositeNodeSelectionProvider>
  );
}
