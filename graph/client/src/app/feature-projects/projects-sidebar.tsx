import { useCallback, useEffect, useState } from 'react';
import { getProjectGraphService } from '../machines/get-services';
import { ExperimentalFeature } from '../ui-components/experimental-feature';
import { FocusedPanel } from '../ui-components/focused-panel';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { useProjectGraphSelector } from './hooks/use-project-graph-selector';
import { TracingAlgorithmType } from './machines/interfaces';
import {
  collapseEdgesSelector,
  compositeContextSelector,
  compositeGraphEnabledSelector,
  focusedProjectNameSelector,
  getTracingInfo,
  groupByFolderSelector,
  hasAffectedProjectsSelector,
  includePathSelector,
  searchDepthSelector,
  textFilterSelector,
} from './machines/selectors';
import { CollapseEdgesPanel } from './panels/collapse-edges-panel';
import { GroupByFolderPanel } from './panels/group-by-folder-panel';
import { SearchDepth } from './panels/search-depth';
import { TextFilterPanel } from './panels/text-filter-panel';
import { TracingPanel } from './panels/tracing-panel';
import { ProjectList } from './project-list';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  fetchProjectGraph,
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
  useRouteConstructor,
} from '@nx/graph/shared';
import {
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { useCurrentPath } from '../hooks/use-current-path';
import { ProjectDetailsModal } from '../ui-components/project-details-modal';
import { CompositeGraphPanel } from './panels/composite-graph-panel';
import { CompositeContextPanel } from '../ui-components/composite-context-panel';
import { getGraphService } from '../machines/graph.service';

export function ProjectsSidebar(): JSX.Element {
  const environmentConfig = useEnvironmentConfig();
  const graphService = getGraphService();
  const projectGraphService = getProjectGraphService();
  const focusedProject = useProjectGraphSelector(focusedProjectNameSelector);
  const searchDepthInfo = useProjectGraphSelector(searchDepthSelector);
  const includePath = useProjectGraphSelector(includePathSelector);
  const textFilter = useProjectGraphSelector(textFilterSelector);
  const hasAffectedProjects = useProjectGraphSelector(
    hasAffectedProjectsSelector
  );
  const groupByFolder = useProjectGraphSelector(groupByFolderSelector);
  const collapseEdges = useProjectGraphSelector(collapseEdgesSelector);
  const compositeEnabled = useProjectGraphSelector(
    compositeGraphEnabledSelector
  );

  const compositeContext = useProjectGraphSelector(compositeContextSelector);

  const isTracing = projectGraphService.getSnapshot().matches('tracing');
  const tracingInfo = useProjectGraphSelector(getTracingInfo);
  const projectGraphDataService = getProjectGraphDataService();

  const routeParams = useParams();
  const currentRoute = useCurrentPath();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProjectRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;
  const [lastHash, setLastHash] = useState(selectedProjectRouteData.hash);
  const params = useParams();
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();

  function resetFocus() {
    projectGraphService.send({ type: 'unfocusProject' });
    navigate(routeConstructor('/projects', true));
  }

  function resetCompositeContext() {
    projectGraphService.send({ type: 'enableCompositeGraph', context: null });
    navigate(
      routeConstructor(
        { pathname: '/projects', search: '?composite=true' },
        true
      )
    );
  }

  function showAllProjects() {
    navigate(
      routeConstructor('/projects/all', (searchParams) => {
        if (searchParams.has('composite')) {
          searchParams.set('composite', 'true');
        }
        return searchParams;
      })
    );
  }

  function hideAllProjects() {
    projectGraphService.send({ type: 'deselectAll' });
    navigate(
      routeConstructor('/projects', (searchParams) => {
        if (searchParams.has('composite')) {
          searchParams.set('composite', 'true');
        }
        return searchParams;
      })
    );
  }

  function showAffectedProjects() {
    navigate(
      routeConstructor('/projects/affected', (searchParams) => {
        if (searchParams.has('composite')) {
          searchParams.set('composite', 'true');
        }
        return searchParams;
      })
    );
  }

  function searchDepthFilterEnabledChange(checked: boolean) {
    setSearchParams((currentSearchParams) => {
      if (checked && searchDepthInfo.searchDepth > 1) {
        currentSearchParams.set(
          'searchDepth',
          searchDepthInfo.searchDepth.toString()
        );
      } else if (checked && searchDepthInfo.searchDepth === 1) {
        currentSearchParams.delete('searchDepth');
      } else {
        currentSearchParams.set('searchDepth', '0');
      }
      return currentSearchParams;
    });
  }

  function groupByFolderChanged(checked: boolean) {
    setSearchParams((currentSearchParams) => {
      if (checked) {
        currentSearchParams.set('groupByFolder', 'true');
      } else {
        currentSearchParams.delete('groupByFolder');
      }
      return currentSearchParams;
    });
  }

  function collapseEdgesChanged(checked: boolean) {
    setSearchParams((currentSearchParams) => {
      if (checked) {
        currentSearchParams.set('collapseEdges', 'true');
      } else {
        currentSearchParams.delete('collapseEdges');
      }
      return currentSearchParams;
    });
  }

  function compositeEnabledChanged(checked: boolean) {
    navigate(
      routeConstructor('/projects', (searchParams) => {
        if (checked) {
          searchParams.set('composite', 'true');
        } else {
          searchParams.delete('composite');
        }
        return searchParams;
      })
    );
  }

  function incrementDepthFilter() {
    const newSearchDepth = searchDepthInfo.searchDepth + 1;
    setSearchParams((currentSearchParams) => {
      if (newSearchDepth === 1) {
        currentSearchParams.delete('searchDepth');
      } else {
        currentSearchParams.set('searchDepth', newSearchDepth.toString());
      }

      return currentSearchParams;
    });
  }

  function decrementDepthFilter() {
    const newSearchDepth =
      searchDepthInfo.searchDepth === 1 ? 1 : searchDepthInfo.searchDepth - 1;
    setSearchParams((currentSearchParams) => {
      if (newSearchDepth === 1) {
        currentSearchParams.delete('searchDepth');
      } else {
        currentSearchParams.set('searchDepth', newSearchDepth.toString());
      }

      return currentSearchParams;
    });
  }

  function resetTextFilter() {
    projectGraphService.send({ type: 'clearTextFilter' });
  }

  function includeLibsInPathChange() {
    projectGraphService.send({
      type: 'setIncludeProjectsByPath',
      includeProjectsByPath: !includePath,
    });
  }

  function resetTraceStart() {
    projectGraphService.send({ type: 'clearTraceStart' });
    navigate(routeConstructor('/projects', true));
  }

  function resetTraceEnd() {
    projectGraphService.send({ type: 'clearTraceEnd' });
    navigate(routeConstructor('/projects', true));
  }

  function setAlgorithm(algorithm: TracingAlgorithmType) {
    setSearchParams((searchParams) => {
      searchParams.set('traceAlgorithm', algorithm);

      return searchParams;
    });
  }

  useEffect(() => {
    return graphService.listen((event) => {
      if (event.type === 'CompositeNodeDblClick') {
        projectGraphService.send({
          type: event.data.expanded
            ? 'collapseCompositeNode'
            : 'expandCompositeNode',
          id: event.id,
        });
      }
    });
  }, []);

  useEffect(() => {
    projectGraphService.send({
      type: 'setProjects',
      projects: selectedProjectRouteData.projects,
      dependencies: selectedProjectRouteData.dependencies,
      fileMap: selectedProjectRouteData.fileMap,
      affectedProjects: selectedProjectRouteData.affected,
      workspaceLayout: selectedProjectRouteData.layout,
    });
  }, [selectedProjectRouteData]);

  useEffect(() => {
    switch (currentRoute.currentPath) {
      case '/projects/all':
        projectGraphService.send({ type: 'selectAll' });
        break;
      case '/projects/affected':
        projectGraphService.send({ type: 'selectAffected' });
        break;
    }
  }, [currentRoute]);

  useEffect(() => {
    if (routeParams.focusedProject) {
      projectGraphService.send({
        type: 'focusProject',
        projectName: routeParams.focusedProject,
      });
    }

    if (routeParams.startTrace) {
      projectGraphService.send({
        type: 'setTracingStart',
        projectName: routeParams.startTrace,
      });
    }
    if (routeParams.endTrace) {
      projectGraphService.send({
        type: 'setTracingEnd',
        projectName: routeParams.endTrace,
      });
    }
  }, [routeParams, compositeEnabled]);

  useEffect(() => {
    if (searchParams.has('groupByFolder') && groupByFolder === false) {
      projectGraphService.send({
        type: 'setGroupByFolder',
        groupByFolder: true,
      });
    } else if (!searchParams.has('groupByFolder') && groupByFolder === true) {
      projectGraphService.send({
        type: 'setGroupByFolder',
        groupByFolder: false,
      });
    }

    if (searchParams.has('collapseEdges') && collapseEdges === false) {
      projectGraphService.send({
        type: 'setCollapseEdges',
        collapseEdges: true,
      });
    } else if (!searchParams.has('collapseEdges') && collapseEdges === true) {
      projectGraphService.send({
        type: 'setCollapseEdges',
        collapseEdges: false,
      });
    }

    if (searchParams.has('composite')) {
      const compositeParam = searchParams.get('composite');
      projectGraphService.send({
        type: 'enableCompositeGraph',
        context: compositeParam === 'true' ? null : compositeParam,
      });
    } else if (!searchParams.has('composite')) {
      projectGraphService.send({ type: 'disableCompositeGraph' });
      navigate(routeConstructor('/projects', true));
    }

    if (searchParams.has('searchDepth')) {
      const parsedValue = parseInt(searchParams.get('searchDepth'), 10);

      if (parsedValue === 0 && searchDepthInfo.searchDepthEnabled !== false) {
        projectGraphService.send({
          type: 'setSearchDepthEnabled',
          searchDepthEnabled: false,
        });
      } else if (parsedValue !== 0) {
        projectGraphService.send({
          type: 'setSearchDepth',
          searchDepth: parsedValue,
        });
      }
    } else if (
      searchDepthInfo.searchDepthEnabled === false ||
      searchDepthInfo.searchDepth !== 1
    ) {
      projectGraphService.send({
        type: 'setSearchDepthEnabled',
        searchDepthEnabled: true,
      });
      projectGraphService.send({
        type: 'setSearchDepth',
        searchDepth: 1,
      });
    }

    if (searchParams.has('traceAlgorithm')) {
      const tracingAlgorithm = searchParams.get('traceAlgorithm');
      if (tracingAlgorithm === 'shortest' || tracingAlgorithm === 'all') {
        projectGraphService.send({
          type: 'setTracingAlgorithm',
          algorithm: tracingAlgorithm,
        });
      }
    } else if (tracingInfo.algorithm !== 'shortest') {
      projectGraphService.send({
        type: 'setTracingAlgorithm',
        algorithm: 'shortest',
      });
    }
  }, [searchParams]);

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
      projectGraphService.send({
        type: 'updateGraph',
        projects: response.projects,
        dependencies: response.dependencies,
        fileMap: response.fileMap,
      });
      setLastHash(response.hash);
    },
    5000,
    environmentConfig.watch
  );

  const updateTextFilter = useCallback(
    (textFilter: string) => {
      projectGraphService.send({ type: 'filterByText', search: textFilter });
      navigate(routeConstructor('/projects', true));
    },
    [projectGraphService]
  );

  return (
    <>
      <ProjectDetailsModal />

      {compositeEnabled && compositeContext ? (
        <CompositeContextPanel
          compositeContext={compositeContext}
          reset={resetCompositeContext}
        />
      ) : null}

      {focusedProject ? (
        <FocusedPanel
          focusedLabel={focusedProject}
          resetFocus={resetFocus}
        ></FocusedPanel>
      ) : null}

      {isTracing ? (
        <TracingPanel
          start={tracingInfo.start}
          end={tracingInfo.end}
          algorithm={tracingInfo.algorithm}
          setAlgorithm={setAlgorithm}
          resetStart={resetTraceStart}
          resetEnd={resetTraceEnd}
        ></TracingPanel>
      ) : null}

      <TextFilterPanel
        includePath={includePath}
        resetTextFilter={resetTextFilter}
        textFilter={textFilter}
        toggleIncludeLibsInPathChange={includeLibsInPathChange}
        updateTextFilter={updateTextFilter}
      ></TextFilterPanel>

      <div>
        <ShowHideAll
          hideAll={hideAllProjects}
          showAll={showAllProjects}
          showAffected={showAffectedProjects}
          hasAffected={hasAffectedProjects}
          label="projects"
        ></ShowHideAll>

        <GroupByFolderPanel
          groupByFolder={groupByFolder}
          groupByFolderChanged={groupByFolderChanged}
          disabled={compositeEnabled}
          disabledDescription="Group by folder is not available when composite graph is enabled"
        ></GroupByFolderPanel>

        <SearchDepth
          searchDepth={searchDepthInfo.searchDepth}
          searchDepthEnabled={searchDepthInfo.searchDepthEnabled}
          searchDepthFilterEnabledChange={searchDepthFilterEnabledChange}
          incrementDepthFilter={incrementDepthFilter}
          decrementDepthFilter={decrementDepthFilter}
        ></SearchDepth>

        <CompositeGraphPanel
          compositeEnabled={compositeEnabled}
          compositeEnabledChanged={compositeEnabledChanged}
        ></CompositeGraphPanel>

        <ExperimentalFeature>
          <div className="mx-4 mt-8 flex flex-col gap-4 rounded-lg border-2 border-dashed border-purple-500 p-4 shadow-lg dark:border-purple-600 dark:bg-[#0B1221]">
            <h3 className="cursor-text px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 lg:text-xs dark:text-slate-200">
              Experimental Features
            </h3>
            <CollapseEdgesPanel
              collapseEdges={collapseEdges}
              collapseEdgesChanged={collapseEdgesChanged}
            ></CollapseEdgesPanel>
          </div>
        </ExperimentalFeature>
      </div>

      {environmentConfig.environment !== 'nx-console' ? (
        <ProjectList></ProjectList>
      ) : null}
    </>
  );
}
