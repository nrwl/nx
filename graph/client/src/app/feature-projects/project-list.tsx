import {
  DocumentMagnifyingGlassIcon,
  EyeIcon,
  FlagIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline';
/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { useProjectGraphSelector } from './hooks/use-project-graph-selector';
import {
  allProjectsSelector,
  getTracingInfo,
  selectedProjectNamesSelector,
  workspaceLayoutSelector,
} from './machines/selectors';
import {
  getProjectsByType,
  parseParentDirectoriesFromFilePath,
  useRouteConstructor,
} from '../util';
import { ExperimentalFeature } from '../ui-components/experimental-feature';
import { TracingAlgorithmType } from './machines/interfaces';
import { getProjectGraphService } from '../machines/get-services';
import { Link, useNavigate } from 'react-router-dom';

interface SidebarProject {
  projectGraphNode: ProjectGraphNode;
  isSelected: boolean;
}

type DirectoryProjectRecord = Record<string, SidebarProject[]>;

interface TracingInfo {
  start: string;
  end: string;
  algorithm: TracingAlgorithmType;
}

function groupProjectsByDirectory(
  projects: ProjectGraphNode[],
  selectedProjects: string[],
  workspaceLayout: { appsDir: string; libsDir: string }
): DirectoryProjectRecord {
  let groups = {};

  projects.forEach((project) => {
    const workspaceRoot =
      project.type === 'app' || project.type === 'e2e'
        ? workspaceLayout.appsDir
        : workspaceLayout.libsDir;
    const directories = parseParentDirectoriesFromFilePath(
      (project.data as any).root,
      workspaceRoot
    );

    const directory = directories.join('/');

    if (!groups.hasOwnProperty(directory)) {
      groups[directory] = [];
    }
    groups[directory].push({
      projectGraphNode: project,
      isSelected: selectedProjects.includes(project.name),
    });
  });

  return groups;
}

function ProjectListItem({
  project,
  tracingInfo,
}: {
  project: SidebarProject;
  tracingInfo: TracingInfo;
}) {
  const projectGraphService = getProjectGraphService();
  const navigate = useNavigate();
  const routeConstructor = useRouteConstructor();

  function startTrace(projectName: string) {
    projectGraphService.send({ type: 'setTracingStart', projectName });
  }

  function endTrace(projectName: string) {
    projectGraphService.send({ type: 'setTracingEnd', projectName });
  }

  function toggleProject(projectName: string, currentlySelected: boolean) {
    if (currentlySelected) {
      projectGraphService.send({ type: 'deselectProject', projectName });
    } else {
      projectGraphService.send({ type: 'selectProject', projectName });
    }
    navigate(routeConstructor('/projects', true));
  }

  return (
    <li className="relative block cursor-default select-none py-1 pl-2 pr-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <Link
          data-cy={`focus-button-${project.projectGraphNode.name}`}
          className="mr-1 flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
          title="Focus on this library"
          to={routeConstructor(
            `/projects/${encodeURIComponent(project.projectGraphNode.name)}`,
            true
          )}
        >
          <DocumentMagnifyingGlassIcon className="h-5 w-5" />
        </Link>

        <ExperimentalFeature>
          <span className="relative z-0 inline-flex rounded-md shadow-sm">
            {/*Once these button are not experimental anymore, button the DocumentSearchIcon button in this span as well. */}
            <button
              type="button"
              title="Start Trace"
              onClick={() => startTrace(project.projectGraphNode.name)}
              className={`${
                tracingInfo.start === project.projectGraphNode.name
                  ? 'ring-blue-500 dark:ring-sky-500'
                  : 'ring-slate-200 dark:ring-slate-600'
              } flex items-center rounded-l-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700`}
            >
              <MapPinIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              title="End Trace"
              onClick={() => endTrace(project.projectGraphNode.name)}
              className={`${
                tracingInfo.end === project.projectGraphNode.name
                  ? 'ring-blue-500 dark:ring-sky-500'
                  : 'ring-slate-200 dark:ring-slate-600'
              } flex items-center rounded-r-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700`}
            >
              <FlagIcon className="h-5 w-5" />
            </button>
          </span>
        </ExperimentalFeature>

        <label
          className="ml-2 block w-full cursor-pointer truncate rounded-md p-2 font-mono font-normal transition hover:bg-slate-50 hover:dark:bg-slate-700"
          data-project={project.projectGraphNode.name}
          title={project.projectGraphNode.name}
          data-active={project.isSelected.toString()}
          onClick={() =>
            toggleProject(project.projectGraphNode.name, project.isSelected)
          }
        >
          {project.projectGraphNode.name}
        </label>
      </div>

      {project.isSelected ? (
        <span
          title="This library is visible"
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-blue-500 dark:text-sky-500"
          onClick={() =>
            toggleProject(project.projectGraphNode.name, project.isSelected)
          }
        >
          <EyeIcon className="h-5 w-5"></EyeIcon>
        </span>
      ) : null}
    </li>
  );
}

function SubProjectList({
  headerText = '',
  projects,
  tracingInfo,
}: {
  headerText: string;
  projects: SidebarProject[];
  tracingInfo: TracingInfo;
}) {
  const projectGraphService = getProjectGraphService();

  let sortedProjects = [...projects];
  sortedProjects.sort((a, b) => {
    return a.projectGraphNode.name.localeCompare(b.projectGraphNode.name);
  });

  function toggleAllProjects(currentlySelected: boolean) {
    const projectNames = projects.map(
      (project) => project.projectGraphNode.name
    );
    if (currentlySelected) {
      projectGraphService.send({ type: 'deselectProjects', projectNames });
    } else {
      projectGraphService.send({ type: 'selectProjects', projectNames });
    }
  }

  const allProjectsSelected = projects.every((project) => project.isSelected);

  return (
    <>
      {headerText !== '' ? (
        <div className="relative mt-4 flex justify-between py-2 text-slate-800 dark:text-slate-200">
          <h3 className="cursor-text text-sm font-semibold uppercase tracking-wide lg:text-xs">
            {headerText}
          </h3>

          <span
            title={
              allProjectsSelected
                ? `Hide all ${headerText} projects`
                : `Show all ${headerText} projects`
            }
            className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-sm font-semibold uppercase tracking-wide lg:text-xs"
            data-cy={`toggle-folder-visibility-button-${headerText}`}
            onClick={() => toggleAllProjects(allProjectsSelected)}
          >
            <EyeIcon className="h-5 w-5"></EyeIcon>
          </span>
        </div>
      ) : null}
      <ul className="mt-2 -ml-3">
        {sortedProjects.map((project) => {
          return (
            <ProjectListItem
              key={project.projectGraphNode.name}
              project={project}
              tracingInfo={tracingInfo}
            ></ProjectListItem>
          );
        })}
      </ul>
    </>
  );
}

export function ProjectList() {
  const tracingInfo = useProjectGraphSelector(getTracingInfo);

  const projects = useProjectGraphSelector(allProjectsSelector);
  const workspaceLayout = useProjectGraphSelector(workspaceLayoutSelector);
  const selectedProjects = useProjectGraphSelector(
    selectedProjectNamesSelector
  );

  const appProjects = getProjectsByType('app', projects);
  const libProjects = getProjectsByType('lib', projects);
  const e2eProjects = getProjectsByType('e2e', projects);

  const appDirectoryGroups = groupProjectsByDirectory(
    appProjects,
    selectedProjects,
    workspaceLayout
  );
  const libDirectoryGroups = groupProjectsByDirectory(
    libProjects,
    selectedProjects,
    workspaceLayout
  );
  const e2eDirectoryGroups = groupProjectsByDirectory(
    e2eProjects,
    selectedProjects,
    workspaceLayout
  );

  const sortedAppDirectories = Object.keys(appDirectoryGroups).sort();
  const sortedLibDirectories = Object.keys(libDirectoryGroups).sort();
  const sortedE2EDirectories = Object.keys(e2eDirectoryGroups).sort();

  return (
    <div id="project-lists" className="mt-8 border-t border-slate-400/10 px-4">
      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        app projects
      </h2>

      {sortedAppDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'app-' + directoryName}
            headerText={directoryName}
            projects={appDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        e2e projects
      </h2>

      {sortedE2EDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'e2e-' + directoryName}
            headerText={directoryName}
            projects={e2eDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        lib projects
      </h2>

      {sortedLibDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'lib-' + directoryName}
            headerText={directoryName}
            projects={libDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}
    </div>
  );
}
