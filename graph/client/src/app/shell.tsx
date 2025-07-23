/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import {
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
  getProjectGraphDataService,
  useEnvironmentConfig,
  usePoll,
} from '@nx/graph-shared';
import { Tooltip, Spinner, ErrorToast, Dropdown } from '@nx/graph-ui-common';
import { getSystemTheme, Theme, ThemePanel } from '@nx/graph-internal-ui-theme';
import classNames from 'classnames';
import { useLayoutEffect, useMemo, useState } from 'react';
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
import { getGraphService } from './machines/graph.service';
import { DebuggerPanel } from './ui-components/debugger-panel';
import { ExperimentalFeature } from './ui-components/experimental-feature';
import { TooltipDisplay } from './ui-tooltips/graph-tooltip-display';
import {
  NxGraphProjectGraphProvider,
  useProjectGraphContext,
} from '@nx/graph/projects';
import { NxGraphTaskGraphProvider, useTaskGraphContext } from '@nx/graph/tasks';

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
  const currentPath = useCurrentPath();
  const currentRoute = currentPath.currentPath;

  const topLevelRoute = currentRoute.startsWith('/tasks')
    ? '/tasks'
    : '/projects';

  if (topLevelRoute.includes('projects')) {
    return (
      <NxGraphProjectGraphProvider renderPlatform="nx" styles={[]}>
        <InnerShell
          topLevelRoute={topLevelRoute}
          workspace={currentPath.workspace}
        />
      </NxGraphProjectGraphProvider>
    );
  }

  return (
    <NxGraphTaskGraphProvider renderPlatform="nx" styles={[]}>
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

  const { containerRef, sendRenderConfigEvent, handleEventResult } =
    useGraphContextFactory(topLevelRoute)();

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

  function onThemeChange(theme: Theme) {
    sendRenderConfigEvent({
      type: 'ThemeChange',
      theme: theme === 'system' ? getSystemTheme() : theme,
    });
  }

  function projectChange(projectGraphId: string) {
    navigate(`/${encodeURIComponent(projectGraphId)}${topLevelRoute}`);
  }

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

  function resetLayout() {
    sendRenderConfigEvent({ type: 'ResetLayout' });
  }

  return (
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
                    projectGraphService.send('deselectAll');
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
                  <RankdirPanel />
                </ExperimentalFeature>

                <ThemePanel onThemeChange={onThemeChange} />
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
        className="flex-grow overflow-hidden transition-all"
      >
        {environmentConfig.appConfig.showDebugger ? (
          <DebuggerPanel
            projects={environmentConfig.appConfig.workspaces}
            selectedProject={params.selectedWorkspaceId}
            graphEventResult={handleEventResult}
            selectedProjectChange={projectChange}
          />
        ) : null}

        {!nodesVisible || navigationState === 'loading' ? (
          <div
            data-cy="no-tasks-selected"
            className="flex h-full w-full items-center justify-center text-slate-700 dark:text-slate-400"
          >
            {navigationState === 'loading' ? (
              <Spinner></Spinner>
            ) : (
              <>
                <ArrowLeftCircleIcon className="mr-4 h-6 w-6" />
                <h4>
                  Please select a{' '}
                  {topLevelRoute.includes('tasks') ? 'task' : 'project'} in the
                  sidebar.
                </h4>
              </>
            )}
          </div>
        ) : null}

        <div className="h-full w-full">
          <div
            ref={containerRef}
            className="h-full w-full cursor-pointer"
            id="cytoscape-graph"
          ></div>

          <TooltipDisplay />

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
  );
}
