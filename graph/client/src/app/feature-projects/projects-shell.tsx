/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
  GraphError,
  ProjectGraphClientResponse,
} from 'nx/src/command-line/graph/graph';

/* eslint-enable @nx/enforce-module-boundaries */
import {
  fetchProjectGraph,
  getExternalApiService,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
  useRouteConstructor,
} from '@nx/graph-shared';
import { useRankDir, useTheme } from '@nx/graph-internal-ui-render-config';
import {
  Link,
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  NxGraphProjectGraphProvider,
  ProjectGraphHandleEventResult,
  useProjectGraphContext,
} from '@nx/graph/projects';
import {
  NxGraphEmpty,
  NxGraphDebuggerPanel,
  useElementPanel,
  NxGraphToolbar,
  NxGraphToolbarItemGroup,
  NxGraphThemeTool,
  NxGraphRankDirTool,
  NxGraphResetLayoutTool,
  NxGraphResetGraphTool,
  NxGraphShareTool,
  NxGraphProjectModeTool,
  NxGraphShowModeTool,
  NxGraphGroupByFolderTool,
  NxGraphCollapseEdgesTool,
  NxGraphElementPanel,
  NxGraphProjectNodePanelContent,
  NxGraphProjectNodePanelHeader,
  NxGraphPanel,
  NxGraphPanelItemGroup,
  NxGraphDependencyDistanceControl,
  NxGraphProjectListControl,
  NxGraphCompositeProjectNodePanelHeader,
  NxGraphProjectEdgePanelHeader,
  NxGraphCompositeProjectEdgePanelHeader,
  NxGraphCompositeProjectNodePanelContent,
  NxGraphCompositeProjectEdgePanelContent,
  NxGraphProjectEdgePanelContent,
} from '@nx/graph/ui';
import { ElementData, useRendererEvents } from '@nx/graph';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/outline';
import { ErrorToast } from '@nx/graph-ui-common';
import classNames from 'classnames';
import { Tab, TabGroup, TabList } from '@headlessui/react';
import { useCurrentPath } from '../hooks/use-current-path';

export function ProjectsShell() {
  const environmentConfig = useEnvironmentConfig();

  const { errors: routerErrors } = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;

  const [errors, setErrors] = useState<GraphError[] | undefined>(routerErrors);

  const renderPlatform = useMemo(
    () =>
      environmentConfig.environment === 'nx-console' ? 'nx-console' : 'nx',
    [environmentConfig.environment]
  );

  useEffect(() => {
    setErrors(routerErrors);
  }, [routerErrors]);

  return (
    <>
      <NxGraphProjectGraphProvider renderPlatform={renderPlatform}>
        <ProjectsShellInner />
      </NxGraphProjectGraphProvider>
      <ErrorToast errors={errors} />
    </>
  );
}

function ProjectsShellInner() {
  const projectGraphDataService = getProjectGraphDataService();
  const externalApiService = getExternalApiService();
  const graphContext = useProjectGraphContext();
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
  const routeConstructor = useRouteConstructor();
  const { currentPath } = useCurrentPath();
  const { resolvedTheme, theme, setTheme } = useTheme();
  const { rankDir, setRankDir } = useRankDir();
  const environmentConfig = useEnvironmentConfig();
  const params = useParams();
  const selectedWorkspaceLoaderData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;
  const [lastHash, setLastHash] = useState(selectedWorkspaceLoaderData.hash);
  const [searchParams, setSearchParams] = useSearchParams();
  const graphState = searchParams.get('graph');

  useRendererEvents(orchestrator, {
    compositeProjectNodeDoubleTap: ({ data }) => {
      if (data.expanded) {
        send({ type: 'collapseCompositeNode', compositeNodeId: data.id });
      } else {
        send({
          type: 'selectNode',
          nodeId: data.id,
          pendingAction: { type: 'expand' },
        });
      }
    },
  });

  const [element] = useElementPanel<
    | ElementData.ProjectNode
    | ElementData.CompositeProjectNode
    | ElementData.SelectedCompositeProjectEdge
    | ElementData.SelectedProjectEdge
  >(orchestrator);

  useEffect(() => {
    if (!orchestrator) return;

    send(
      {
        type: 'initGraph',
        projects: selectedWorkspaceLoaderData.projects,
        dependencies: selectedWorkspaceLoaderData.dependencies,
        fileMap: selectedWorkspaceLoaderData.fileMap,
        affectedProjects: selectedWorkspaceLoaderData.affected,
      },
      {
        type: 'updateRendererConfig',
        updater: () => ({
          autoExpand: 15,
          rankDir,
          theme: resolvedTheme,
          showMode: 'all',
        }),
      },
      { type: 'showAll' }
    );
  }, [orchestrator]);

  useEffect(() => {
    sendRendererConfigEvent({ type: 'themeChange', theme: resolvedTheme });
  }, [resolvedTheme]);

  useEffect(() => {
    sendRendererConfigEvent({ type: 'rankDirChange', rankDir });
  }, [rankDir]);

  useEffect(() => {
    if (!graphState || !orchestrator || graphState === serializedGraphState) {
      return;
    }

    const result = restoreGraphState(graphState);
    if (!result) return;

    if (result.rendererConfig.rankDir !== rankDir) {
      setRankDir(result.rendererConfig.rankDir);
    }

    if (
      result.rendererConfig.platform !== 'nx-console' &&
      result.rendererConfig.theme !== resolvedTheme
    ) {
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

  usePoll(
    async () => {
      const response: ProjectGraphClientResponse = await fetchProjectGraph(
        projectGraphDataService,
        params,
        environmentConfig.appConfig
      );

      if (response.hash === lastHash) {
        return;
      }

      send({
        type: 'updateGraph',
        projects: response.projects,
        dependencies: response.dependencies,
        fileMap: response.fileMap,
        affectedProjects: response.affected,
      });

      setLastHash(response.hash);
    },
    5000,
    environmentConfig.watch
  );

  const onViewProjectDetailsClick = (project: ElementData.ProjectNode) => {
    if (handleEventResult.rendererConfig.platform === 'nx-dev') return;

    if (handleEventResult.rendererConfig.platform === 'nx-console') {
      return externalApiService.postEvent({
        type: 'open-project-config',
        payload: { projectName: project.name, projectId: project.id },
      });
    }

    return navigate(
      routeConstructor(
        { pathname: `/project-details/${encodeURIComponent(project.name)}` },
        () => {
          const searchParams = new URLSearchParams();
          searchParams.set('projectId', project.id);
          return searchParams;
        }
      )
    );
  };

  return (
    <div className="flex h-full w-full flex-col">
      {environmentConfig.appConfig.showDebugger ? (
        <NxGraphDebuggerPanel
          position="top"
          containerClassName="static bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-300 dark:border-slate-800"
          expandButtonClassName="text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
          copyButtonClassName="text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-600"
          textareaClassName="bg-slate-50 dark:bg-slate-800"
          statsClassName="text-slate-600 dark:text-slate-200"
          textareaLabelClassName="text-slate-600 dark:text-slate-200"
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
            {handleEventResult.rendererConfig.platform !== 'nx-console' ? (
              <NxGraphThemeTool
                theme={theme}
                setTheme={setTheme}
                toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
                toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
                toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
                toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
              />
            ) : null}
            <NxGraphRankDirTool
              onRankDirChange={setRankDir}
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
              toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
            />
          </NxGraphToolbarItemGroup>
          <NxGraphToolbarItemGroup className="pl-2 pr-0">
            <NxGraphResetLayoutTool toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600" />
            <NxGraphResetGraphTool toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600" />
            <NxGraphShareTool
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
            />
          </NxGraphToolbarItemGroup>
          <NxGraphToolbarItemGroup className="pl-2 pr-0">
            <NxGraphProjectModeTool
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
              toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
            />
            {handleEventResult.rendererConfig.mode === 'individual' && (
              <>
                <NxGraphGroupByFolderTool
                  toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
                  toolActiveClassName="bg-sky-500 dark:bg-sky-600 text-white dark:text-white"
                />
                <NxGraphCollapseEdgesTool
                  toolClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
                  toolActiveClassName="bg-sky-500 dark:bg-sky-600 text-white dark:text-white"
                  toolDisabledClassName="opacity-50 cursor-not-allowed hover:bg-transparent hover:text-slate-400 dark:hover:text-slate-600 border-slate-300 dark:border-slate-600"
                />
              </>
            )}
          </NxGraphToolbarItemGroup>
          <NxGraphToolbarItemGroup last className="pl-2">
            <NxGraphShowModeTool
              toolPopoverButtonClassName="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600"
              toolPopoverPanelClassName="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 z-50"
              toolPopoverPanelItemClassName="hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-slate-200 dark:text-slate-300"
              toolPopoverPanelItemActiveClassName="text-slate-200 bg-sky-500 dark:bg-sky-600"
            />
          </NxGraphToolbarItemGroup>
        </NxGraphToolbar>

        <NxGraphEmpty className="z-40 flex items-center gap-2 bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          <ArrowLeftCircleIcon className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          <h4 className="text-slate-700 dark:text-slate-300">
            No projects found for the current graph configuration.
          </h4>
        </NxGraphEmpty>

        {handleEventResult.rendererConfig.platform === 'nx-console' ? (
          <ProjectGraphControlsPanel handleEventResult={handleEventResult} />
        ) : (
          <div className="absolute bottom-0 left-0 top-4 flex flex-col">
            <div className="mb-2 ml-4 min-w-96 max-w-96">
              <TabGroup>
                <TabList className="flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                  <Tab
                    className={classNames(
                      'text-md flex-1 rounded-md px-3 py-1.5 font-medium transition-colors',
                      currentPath === '/projects'
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100'
                    )}
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
                    onClick={() => navigate('../tasks')}
                  >
                    Tasks
                  </Tab>
                </TabList>
              </TabGroup>
            </div>
            <div className="relative flex-1">
              <ProjectGraphControlsPanel
                handleEventResult={handleEventResult}
                closable={false}
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
            project: (element, { open, close }) => (
              <NxGraphProjectNodePanelHeader
                element={element}
                open={open}
                close={close}
                badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
                elementNameClassName="text-slate-900 dark:text-slate-100"
                closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              />
            ),
            'composite-project': (element, { open, close }) => (
              <NxGraphCompositeProjectNodePanelHeader
                element={element}
                open={open}
                close={close}
                badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
                elementNameClassName="text-slate-900 dark:text-slate-100"
                closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              />
            ),
            'project-edge': (element, { open, close }) => (
              <NxGraphProjectEdgePanelHeader
                element={element}
                open={open}
                close={close}
                badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
                closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              />
            ),
            'composite-project-edge': (element, { open, close }) => (
              <NxGraphCompositeProjectEdgePanelHeader
                element={element}
                open={open}
                close={close}
                badgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 uppercase"
                closeButtonClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
              />
            ),
          }}
        >
          {{
            project: (element) => (
              <NxGraphProjectNodePanelContent
                element={element}
                sectionHeadingClassName="text-slate-900 dark:text-slate-100"
                sectionTextClassName="text-slate-700 dark:text-slate-300"
                tagBadgeClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600"
                actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
                viewProjectDetailsButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
                cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
                dependencyItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                dependentItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                emptyItemListClassName="text-slate-600 dark:text-slate-400"
                traceAlgorithmButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
                traceAlgorithmActiveButtonClassName="bg-sky-500 dark:bg-sky-600 text-white hover:bg-sky-600 dark:hover:bg-sky-700 border-sky-500 dark:border-sky-600"
                traceableProjectItemClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 justify-between"
                traceableProjectSelectedItemClassName="bg-sky-500/10 dark:bg-sky-600/10 text-slate-900 dark:text-slate-100"
                onViewProjectDetailsClick={() =>
                  onViewProjectDetailsClick(element)
                }
              />
            ),
            'project-edge': (element) => (
              <NxGraphProjectEdgePanelContent
                element={element}
                sectionHeadingClassName="text-slate-900 dark:text-slate-100"
                sectionTextClassName="text-slate-700 dark:text-slate-300"
                projectNameClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                sectionListContainerClassName="border-slate-200 dark:border-slate-700"
                sectionListSectionClassName="bg-slate-50 dark:bg-slate-800"
                sectionListHeaderClassName="text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800"
                sectionListHeaderLabelClassName="text-slate-600 dark:text-slate-400"
                sectionListItemsClassName="divide-slate-200 dark:divide-slate-700"
                sectionListItemClassName="bg-slate-50 dark:bg-slate-700"
                sectionListItemLabelClassName="text-slate-900 dark:text-slate-100"
              />
            ),
            'composite-project': (element) => (
              <NxGraphCompositeProjectNodePanelContent
                element={element}
                sectionHeadingClassName="text-slate-900 dark:text-slate-100"
                sectionTextClassName="text-slate-700 dark:text-slate-300"
                actionButtonClassName="bg-slate-100/60 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border-slate-300 dark:border-slate-600"
                cancelActionButtonClassName="bg-red-500 dark:bg-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 border-red-500 dark:border-red-600"
                confirmActionButtonClassName="bg-sky-500 dark:bg-sky-600 text-white hover:bg-sky-600 dark:hover:bg-sky-700 border-sky-500 dark:border-sky-600"
                multiselectContainerClassName="text-slate-700 dark:text-slate-300"
                multiselectFilterInputClassName="bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:border-sky-500 dark:focus:border-sky-400"
                multiselectEmptyStateClassName="text-slate-600 dark:text-slate-400"
                multiselectListItemClassName="hover:bg-slate-100 dark:hover:bg-slate-700"
                multiselectCheckboxClassName="border-slate-300 dark:border-slate-600 accent-sky-500"
                multiselectLabelClassName="text-slate-700 dark:text-slate-300"
                multiselectSectionHeaderClassName="text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-700"
              />
            ),
            'composite-project-edge': (element) => (
              <NxGraphCompositeProjectEdgePanelContent
                element={element}
                sectionHeadingClassName="text-slate-900 dark:text-slate-100"
                sectionTextClassName="text-slate-700 dark:text-slate-300"
                projectNameClassName="text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                sectionListContainerClassName="border-slate-200 dark:border-slate-700"
                sectionListSectionClassName="bg-slate-50 dark:bg-slate-800"
                sectionListHeaderClassName="text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-800"
                sectionListHeaderLabelClassName="text-slate-600 dark:text-slate-400"
                sectionListItemsClassName="divide-slate-200 dark:divide-slate-700"
                sectionListItemClassName="bg-slate-50 dark:bg-slate-700"
                sectionListItemLabelClassName="text-slate-900 dark:text-slate-100"
              />
            ),
          }}
        </NxGraphElementPanel>
      </div>
    </div>
  );
}

function ProjectGraphControlsPanel({
  handleEventResult,
  closable = true,
}: {
  handleEventResult: ProjectGraphHandleEventResult;
  closable?: boolean;
}) {
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
      {handleEventResult.state.type === 'focused' ? (
        <NxGraphPanelItemGroup>
          <NxGraphDependencyDistanceControl
            controlLabelClassName="text-slate-900 dark:text-slate-100"
            controlDescriptionClassName="text-slate-600 dark:text-slate-400"
            controlInputClassName="border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-sky-500/20 dark:focus:ring-sky-400/20"
            removeFocusButtonClassName="bg-red-500 dark:bg-red-600 text-white"
          />
        </NxGraphPanelItemGroup>
      ) : null}
      <NxGraphPanelItemGroup last>
        <NxGraphProjectListControl
          projectItemClassName={({ rendered }) =>
            rendered
              ? 'text-slate-900 dark:text-slate-50 hover:bg-slate-100 dark:hover:bg-slate-700'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }
          projectItemSelectIconClassName={() =>
            'hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-sky-500 dark:hover:text-sky-400'
          }
          searchInputClassName="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-300 dark:border-slate-600 focus:border-transparent focus:ring-2 focus:ring-sky-500/20 dark:focus:ring-sky-400/20 focus:outline-none data-[focus]:border-sky-500 dark:data-[focus]:border-sky-400 data-[focus]:ring-2 data-[focus]:ring-sky-500/20 dark:data-[focus]:ring-sky-400/20"
          searchInputClearButtonClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-white border-slate-300 dark:border-slate-600"
          searchInputIncludeButtonClassName="bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-sky-500 dark:hover:bg-sky-600 hover:text-white border-slate-300 dark:border-slate-600"
          projectListEmptyClassName="text-slate-600 dark:text-slate-400"
          projectSectionHeaderClassName="text-slate-900 dark:text-slate-100"
        />
      </NxGraphPanelItemGroup>
    </NxGraphPanel>
  );
}
