import { ArrowCircleLeftIcon, DownloadIcon } from '@heroicons/react/solid';
import Tippy from '@tippyjs/react';
import classNames from 'classnames';
// nx-ignore-next-line
import type { DepGraphClientResponse } from 'nx/src/command-line/dep-graph';
import { useEffect, useState } from 'react';
import DebuggerPanel from './debugger-panel';
import { useDepGraphService } from './hooks/use-dep-graph';
import { useDepGraphSelector } from './hooks/use-dep-graph-selector';
import { useEnvironmentConfig } from './hooks/use-environment-config';
import { useIntervalWhen } from './hooks/use-interval-when';
import { useProjectGraphDataService } from './hooks/use-project-graph-data-service';
import { getGraphService } from './machines/graph.service';
import {
  lastPerfReportSelector,
  projectIsSelectedSelector,
} from './machines/selectors';
import Sidebar from './sidebar/sidebar';
import { selectValueByThemeStatic } from './theme-resolver';

export function Shell() {
  const depGraphService = useDepGraphService();

  const projectGraphService = useProjectGraphDataService();
  const environment = useEnvironmentConfig();
  const lastPerfReport = useDepGraphSelector(lastPerfReportSelector);
  const projectIsSelected = useDepGraphSelector(projectIsSelectedSelector);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    environment.appConfig.defaultProjectGraph
  );

  function projectChange(projectGraphId: string) {
    setSelectedProjectId(projectGraphId);
  }

  useEffect(() => {
    const { appConfig } = environment;

    const projectInfo = appConfig.projectGraphs.find(
      (graph) => graph.id === selectedProjectId
    );

    const fetchProjectGraph = async () => {
      const project: DepGraphClientResponse =
        await projectGraphService.getProjectGraph(projectInfo.url);

      const workspaceLayout = project?.layout;
      depGraphService.send({
        type: 'initGraph',
        projects: project.projects,
        dependencies: project.dependencies,
        affectedProjects: project.affected,
        workspaceLayout: workspaceLayout,
      });
    };
    fetchProjectGraph();
  }, [selectedProjectId, environment, depGraphService, projectGraphService]);

  useIntervalWhen(
    () => {
      const projectInfo = environment.appConfig.projectGraphs.find(
        (graph) => graph.id === selectedProjectId
      );

      const fetchProjectGraph = async () => {
        const project: DepGraphClientResponse =
          await projectGraphService.getProjectGraph(projectInfo.url);

        depGraphService.send({
          type: 'updateGraph',
          projects: project.projects,
          dependencies: project.dependencies,
        });
      };

      fetchProjectGraph();
    },
    5000,
    environment.watch
  );

  function downloadImage() {
    const graph = getGraphService();
    const data = graph.getImage();

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

  return (
    <>
      <Sidebar></Sidebar>
      <div
        id="main-content"
        className="flex-grow overflow-hidden transition-all"
      >
        {environment.appConfig.showDebugger ? (
          <DebuggerPanel
            projectGraphs={environment.appConfig.projectGraphs}
            selectedProjectGraph={selectedProjectId}
            lastPerfReport={lastPerfReport}
            projectGraphChange={projectChange}
          ></DebuggerPanel>
        ) : null}

        {!projectIsSelected ? (
          <div
            id="no-projects-chosen"
            className="flex text-slate-700 dark:text-slate-400"
          >
            <ArrowCircleLeftIcon className="mr-4 h-6 w-6" />
            <h4>Please select projects in the sidebar.</h4>
          </div>
        ) : null}
        <div id="graph-container">
          <div id="cytoscape-graph"></div>
          <Tippy
            content="Download Graph as PNG"
            placement="right"
            theme={selectValueByThemeStatic('dark-nx', 'nx')}
          >
            <button
              type="button"
              className={classNames(
                !projectIsSelected ? 'opacity-0' : '',
                'bg-green-nx-base fixed bottom-4 right-4 z-50 block h-16 w-16 transform rounded-full text-white shadow-sm transition duration-300'
              )}
              data-cy="downloadImageButton"
              onClick={downloadImage}
            >
              <DownloadIcon className="absolute top-1/2 left-1/2 -mt-3 -ml-3 h-6 w-6" />
            </button>
          </Tippy>
        </div>
      </div>
    </>
  );
}
