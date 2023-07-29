import { useCallback, useEffect } from 'react';
import { ExperimentalFeature } from '../ui-components/experimental-feature';
import { useProjectGraphSelector } from './hooks/use-project-graph-selector';
import {
  collapseEdgesSelector,
  focusedProjectNameSelector,
  getTracingInfo,
  groupByFolderSelector,
  hasAffectedProjectsSelector,
  includePathSelector,
  searchDepthSelector,
  textFilterSelector,
} from './machines/selectors';
import { CollapseEdgesPanel } from './panels/collapse-edges-panel';
import { FocusedPanel } from '../ui-components/focused-panel';
import { GroupByFolderPanel } from './panels/group-by-folder-panel';
import { ProjectList } from './project-list';
import { SearchDepth } from './panels/search-depth';
import { ShowHideAll } from '../ui-components/show-hide-all';
import { TextFilterPanel } from './panels/text-filter-panel';
import { TracingPanel } from './panels/tracing-panel';
import { useEnvironmentConfig } from '../hooks/use-environment-config';
import { TracingAlgorithmType } from './machines/interfaces';
import { getProjectGraphService } from '../machines/get-services';
import { useIntervalWhen } from '../hooks/use-interval-when';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphClientResponse } from 'nx/src/command-line/graph/graph';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  useNavigate,
  useParams,
  useRouteLoaderData,
  useSearchParams,
} from 'react-router-dom';
import { getProjectGraphDataService } from '../hooks/get-project-graph-data-service';
import { useCurrentPath } from '../hooks/use-current-path';
import { useRouteConstructor } from '../util';

export function ProjectsSidebar(): JSX.Element {
  const environmentConfig = useEnvironmentConfig();
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

  const isTracing = projectGraphService.getSnapshot().matches('tracing');
  const tracingInfo = useProjectGraphSelector(getTracingInfo);
  const projectGraphDataService = getProjectGraphDataService();

  const routeParams = useParams();
  const currentRoute = useCurrentPath();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedProjectRouteData = useRouteLoaderData(
    'selectedWorkspace'
  ) as ProjectGraphClientResponse;
  const params = useParams();
  const navigate = useNavigate();
  const routeContructor = useRouteConstructor();

  function resetFocus() {
    projectGraphService.send({ type: 'unfocusProject' });
    navigate(routeContructor('/projects', true));
  }

  function showAllProjects() {
    navigate(routeContructor('/projects/all', true));
  }

  function hideAllProjects() {
    projectGraphService.send({ type: 'deselectAll' });
    navigate(routeContructor('/projects', true));
  }

  function showAffectedProjects() {
    navigate(routeContructor('/projects/affected', true));
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
    navigate(routeContructor('/projects', true));
  }

  function resetTraceEnd() {
    projectGraphService.send({ type: 'clearTraceEnd' });
    navigate(routeContructor('/projects', true));
  }

  function setAlgorithm(algorithm: TracingAlgorithmType) {
    setSearchParams((searchParams) => {
      searchParams.set('traceAlgorithm', algorithm);

      return searchParams;
    });
  }

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
  }, [routeParams]);

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

  useIntervalWhen(
    () => {
      const selectedWorkspaceId =
        params.selectedWorkspaceId ??
        environmentConfig.appConfig.defaultWorkspaceId;

      const projectInfo = environmentConfig.appConfig.workspaces.find(
        (graph) => graph.id === selectedWorkspaceId
      );

      const fetchProjectGraph = async () => {
        const response: ProjectGraphClientResponse =
          await projectGraphDataService.getProjectGraph(
            projectInfo.projectGraphUrl
          );

        projectGraphService.send({
          type: 'updateGraph',
          projects: response.projects,
          dependencies: response.dependencies,
          fileMap: response.fileMap,
        });
      };

      fetchProjectGraph();
    },
    5000,
    environmentConfig.watch
  );

  const updateTextFilter = useCallback(
    (textFilter: string) => {
      projectGraphService.send({ type: 'filterByText', search: textFilter });
      navigate(routeContructor('/projects', true));
    },
    [projectGraphService]
  );

  return (
    <>
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
        ></GroupByFolderPanel>

        <SearchDepth
          searchDepth={searchDepthInfo.searchDepth}
          searchDepthEnabled={searchDepthInfo.searchDepthEnabled}
          searchDepthFilterEnabledChange={searchDepthFilterEnabledChange}
          incrementDepthFilter={incrementDepthFilter}
          decrementDepthFilter={decrementDepthFilter}
        ></SearchDepth>

        <ExperimentalFeature>
          <div className="mx-4 mt-4 rounded-lg border-2 border-dashed border-purple-500 p-4 shadow-lg dark:border-purple-600 dark:bg-[#0B1221]">
            <h3 className="cursor-text px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200 lg:text-xs">
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
