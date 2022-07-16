import {
  DocumentMagnifyingGlassIcon,
  FlagIcon,
  MapPinIcon,
} from '@heroicons/react/24/solid';
// nx-ignore-next-line
import type { ProjectGraphNode } from '@nrwl/devkit';
import { useDepGraphService } from '../hooks/use-dep-graph';
import { useDepGraphSelector } from '../hooks/use-dep-graph-selector';
import {
  allProjectsSelector,
  getTracingInfo,
  selectedProjectNamesSelector,
  workspaceLayoutSelector,
} from '../machines/selectors';
import { parseParentDirectoriesFromFilePath } from '../util';
import { TracingAlgorithmType } from '../machines/interfaces';
import ExperimentalFeature from '../experimental-feature';

function getProjectsByType(type: string, projects: ProjectGraphNode[]) {
  return projects
    .filter((project) => project.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
      project.data.root,
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
  toggleProject,
  focusProject,
  startTrace,
  endTrace,
  tracingInfo,
}: {
  project: SidebarProject;
  toggleProject: (projectId: string, currentlySelected: boolean) => void;
  focusProject: (projectId: string) => void;
  startTrace: (projectId: string) => void;
  endTrace: (projectId: string) => void;
  tracingInfo: TracingInfo;
}) {
  return (
    <li className="relative block cursor-default select-none py-1 pl-2 pr-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <button
          data-cy={`focus-button-${project.projectGraphNode.name}`}
          type="button"
          className="mr-1 flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
          title="Focus on this library"
          onClick={() => focusProject(project.projectGraphNode.name)}
        >
          <DocumentMagnifyingGlassIcon className="h-5 w-5" />
        </button>

        <ExperimentalFeature>
          <span className="relative z-0 inline-flex rounded-md shadow-sm">
            {/*Once these button are not experimental anymore, button the DocumentSearchIcon button in this span as well. */}
            <button
              type="button"
              title="Start Trace"
              onClick={() => startTrace(project.projectGraphNode.name)}
              className={`${
                tracingInfo.start === project.projectGraphNode.name
                  ? 'ring-blue-nx-base'
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
                  ? 'ring-blue-nx-base'
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
          className="text-green-nx-base absolute inset-y-0 right-0 flex cursor-pointer items-center"
          onClick={() =>
            toggleProject(project.projectGraphNode.name, project.isSelected)
          }
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </span>
      ) : null}
    </li>
  );
}

function SubProjectList({
  headerText = '',
  projects,
  selectProject,
  deselectProject,
  focusProject,
  startTrace,
  endTrace,
  tracingInfo,
}: {
  headerText: string;
  projects: SidebarProject[];
  selectProject: (projectName: string) => void;
  deselectProject: (projectName: string) => void;
  focusProject: (projectName: string) => void;
  startTrace: (projectId: string) => void;
  endTrace: (projectId: string) => void;
  tracingInfo: TracingInfo;
}) {
  let sortedProjects = [...projects];
  sortedProjects.sort((a, b) => {
    return a.projectGraphNode.name.localeCompare(b.projectGraphNode.name);
  });

  function toggleProject(projectName: string, currentlySelected: boolean) {
    if (currentlySelected) {
      deselectProject(projectName);
    } else {
      selectProject(projectName);
    }
  }

  return (
    <>
      {headerText !== '' ? (
        <h3 className="mt-4 cursor-text py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200 lg:text-xs">
          {headerText}
        </h3>
      ) : null}
      <ul className="mt-2 -ml-3">
        {sortedProjects.map((project) => {
          return (
            <ProjectListItem
              key={project.projectGraphNode.name}
              project={project}
              toggleProject={toggleProject}
              focusProject={focusProject}
              startTrace={startTrace}
              endTrace={endTrace}
              tracingInfo={tracingInfo}
            ></ProjectListItem>
          );
        })}
      </ul>
    </>
  );
}

export function ProjectList() {
  const depGraphService = useDepGraphService();
  const tracingInfo = useDepGraphSelector(getTracingInfo);

  function deselectProject(projectName: string) {
    depGraphService.send({ type: 'deselectProject', projectName });
  }

  function selectProject(projectName: string) {
    depGraphService.send({ type: 'selectProject', projectName });
  }

  function focusProject(projectName: string) {
    depGraphService.send({ type: 'focusProject', projectName });
  }

  function startTrace(projectName: string) {
    depGraphService.send({ type: 'setTracingStart', projectName });
  }

  function endTrace(projectName: string) {
    depGraphService.send({ type: 'setTracingEnd', projectName });
  }

  const projects = useDepGraphSelector(allProjectsSelector);
  const workspaceLayout = useDepGraphSelector(workspaceLayoutSelector);
  const selectedProjects = useDepGraphSelector(selectedProjectNamesSelector);

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
            deselectProject={deselectProject}
            selectProject={selectProject}
            focusProject={focusProject}
            startTrace={startTrace}
            endTrace={endTrace}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light">
        e2e projects
      </h2>

      {sortedE2EDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'e2e-' + directoryName}
            headerText={directoryName}
            projects={e2eDirectoryGroups[directoryName]}
            deselectProject={deselectProject}
            selectProject={selectProject}
            focusProject={focusProject}
            startTrace={startTrace}
            endTrace={endTrace}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light">
        lib projects
      </h2>

      {sortedLibDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'lib-' + directoryName}
            headerText={directoryName}
            projects={libDirectoryGroups[directoryName]}
            deselectProject={deselectProject}
            selectProject={selectProject}
            focusProject={focusProject}
            startTrace={startTrace}
            endTrace={endTrace}
            tracingInfo={tracingInfo}
          ></SubProjectList>
        );
      })}
    </div>
  );
}

export default ProjectList;
