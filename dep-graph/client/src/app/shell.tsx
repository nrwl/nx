// nx-ignore-next-line
import type { DepGraphClientResponse } from 'nx/src/command-line/dep-graph';
import Tippy from '@tippyjs/react';
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
      <div id="main-content" className="flex-grow overflow-hidden">
        {environment.appConfig.showDebugger ? (
          <DebuggerPanel
            projectGraphs={environment.appConfig.projectGraphs}
            selectedProjectGraph={selectedProjectId}
            lastPerfReport={lastPerfReport}
            projectGraphChange={projectChange}
          ></DebuggerPanel>
        ) : null}

        {!projectIsSelected ? (
          <div id="no-projects-chosen" className="flex text-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="mr-4 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 01-18 0z"
              />
            </svg>
            <h4>Please select projects in the sidebar.</h4>
          </div>
        ) : null}
        <div id="graph-container">
          <div id="cytoscape-graph"></div>
          <Tippy content="Download Graph as PNG" placement="right" theme="nx">
            <button
              type="button"
              className={`
            bg-green-nx-base
            fixed
            bottom-4
            right-4
            z-50
            block
            h-16
            w-16
            transform
            rounded-full
            text-white
            shadow-sm
            transition
            duration-300
            ${!projectIsSelected ? 'opacity-0' : ''}
          `}
              data-cy="downloadImageButton"
              onClick={downloadImage}
            >
              <svg
                height="24"
                width="24"
                className="absolute top-1/2 left-1/2 -mt-3 -ml-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                ></path>
              </svg>
            </button>
          </Tippy>
        </div>
      </div>
    </>
  );
}
