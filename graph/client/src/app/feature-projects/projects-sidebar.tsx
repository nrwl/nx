import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { useCallback } from 'react';
import ExperimentalFeature from '../experimental-feature';
import { useDepGraphService } from '../hooks/use-dep-graph';
import { useDepGraphSelector } from '../hooks/use-dep-graph-selector';
import {
  collapseEdgesSelector,
  focusedProjectNameSelector,
  getTracingInfo,
  groupByFolderSelector,
  hasAffectedProjectsSelector,
  includePathSelector,
  searchDepthSelector,
  textFilterSelector,
} from '../machines/selectors';
import CollapseEdgesPanel from '../sidebar/collapse-edges-panel';
import FocusedProjectPanel from '../sidebar/focused-project-panel';
import GroupByFolderPanel from '../sidebar/group-by-folder-panel';
import ProjectList from '../sidebar/project-list';
import SearchDepth from '../sidebar/search-depth';
import ShowHideProjects from '../sidebar/show-hide-projects';
import TextFilterPanel from '../sidebar/text-filter-panel';
import TracingPanel from '../sidebar/tracing-panel';
import { TracingAlgorithmType } from '../machines/interfaces';
import { useEnvironmentConfig } from '../hooks/use-environment-config';

export function ProjectsSidebar(): JSX.Element {
  const environmentConfig = useEnvironmentConfig();
  const depGraphService = useDepGraphService();
  const focusedProject = useDepGraphSelector(focusedProjectNameSelector);
  const searchDepthInfo = useDepGraphSelector(searchDepthSelector);
  const includePath = useDepGraphSelector(includePathSelector);
  const textFilter = useDepGraphSelector(textFilterSelector);
  const hasAffectedProjects = useDepGraphSelector(hasAffectedProjectsSelector);
  const groupByFolder = useDepGraphSelector(groupByFolderSelector);
  const collapseEdges = useDepGraphSelector(collapseEdgesSelector);

  const isTracing = depGraphService.state.matches('tracing');

  // const isTracing = depGraphService.state.matches('tracing');
  const tracingInfo = useDepGraphSelector(getTracingInfo);

  function resetFocus() {
    depGraphService.send({ type: 'unfocusProject' });
  }

  function showAllProjects() {
    depGraphService.send({ type: 'selectAll' });
  }

  function hideAllProjects() {
    depGraphService.send({ type: 'deselectAll' });
  }

  function showAffectedProjects() {
    depGraphService.send({ type: 'selectAffected' });
  }

  function searchDepthFilterEnabledChange(checked: boolean) {
    depGraphService.send({
      type: 'setSearchDepthEnabled',
      searchDepthEnabled: checked,
    });
  }

  function groupByFolderChanged(checked: boolean) {
    depGraphService.send({ type: 'setGroupByFolder', groupByFolder: checked });
  }

  function collapseEdgesChanged(checked: boolean) {
    depGraphService.send({ type: 'setCollapseEdges', collapseEdges: checked });
  }

  function incrementDepthFilter() {
    depGraphService.send({ type: 'incrementSearchDepth' });
  }

  function decrementDepthFilter() {
    depGraphService.send({ type: 'decrementSearchDepth' });
  }

  function resetTextFilter() {
    depGraphService.send({ type: 'clearTextFilter' });
  }

  function includeLibsInPathChange() {
    depGraphService.send({
      type: 'setIncludeProjectsByPath',
      includeProjectsByPath: !includePath,
    });
  }

  function resetTraceStart() {
    depGraphService.send({ type: 'clearTraceStart' });
  }

  function resetTraceEnd() {
    depGraphService.send({ type: 'clearTraceEnd' });
  }

  function setAlgorithm(algorithm: TracingAlgorithmType) {
    depGraphService.send({ type: 'setTracingAlgorithm', algorithm: algorithm });
  }

  const updateTextFilter = useCallback(
    (textFilter: string) => {
      depGraphService.send({ type: 'filterByText', search: textFilter });
    },
    [depGraphService]
  );

  return (
    <>
      {focusedProject ? (
        <FocusedProjectPanel
          focusedProject={focusedProject}
          resetFocus={resetFocus}
        ></FocusedProjectPanel>
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
        <ShowHideProjects
          hideAllProjects={hideAllProjects}
          showAllProjects={showAllProjects}
          showAffectedProjects={showAffectedProjects}
          hasAffectedProjects={hasAffectedProjects}
        ></ShowHideProjects>

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

export default ProjectsSidebar;
