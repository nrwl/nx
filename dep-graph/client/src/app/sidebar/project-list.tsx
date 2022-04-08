import { DocumentSearchIcon } from '@heroicons/react/solid';
// nx-ignore-next-line
import type { ProjectGraphNode } from '@nrwl/devkit';
import { useDepGraphService } from '../hooks/use-dep-graph';
import { useDepGraphSelector } from '../hooks/use-dep-graph-selector';
import {
  allProjectsSelector,
  selectedProjectNamesSelector,
  workspaceLayoutSelector,
} from '../machines/selectors';
import { parseParentDirectoriesFromPilePath } from '../util';

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
    const directories = parseParentDirectoriesFromPilePath(
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
}: {
  project: SidebarProject;
  toggleProject: (projectId: string, currentlySelected: boolean) => void;
  focusProject: (projectId: string) => void;
}) {
  return (
    <li className="relative block cursor-default select-none py-1 pl-3 pr-9 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <button
          type="button"
          className="flex rounded-md"
          title="Focus on this library"
          onClick={() => focusProject(project.projectGraphNode.name)}
        >
          <span className="flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700">
            <DocumentSearchIcon className="h-5 w-5" />
          </span>
        </button>
        <label
          className="ml-3 block w-full cursor-pointer truncate rounded-md p-2 font-mono font-normal transition hover:bg-slate-50 hover:dark:bg-slate-700"
          data-project={project.projectGraphNode.name}
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
  headerText,
  projects,
  selectProject,
  deselectProject,
  focusProject,
}: {
  headerText: string;
  projects: SidebarProject[];
  selectProject: (projectName: string) => void;
  deselectProject: (projectName: string) => void;
  focusProject: (projectName: string) => void;
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
      <h3 className="mt-4 cursor-text py-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-200 lg:text-xs">
        {headerText}
      </h3>
      <ul className="mt-2 -ml-3">
        {sortedProjects.map((project) => {
          return (
            <ProjectListItem
              key={project.projectGraphNode.name}
              project={project}
              toggleProject={toggleProject}
              focusProject={focusProject}
            ></ProjectListItem>
          );
        })}
      </ul>
    </>
  );
}

export function ProjectList() {
  const depGraphService = useDepGraphService();

  function deselectProject(projectName: string) {
    depGraphService.send({ type: 'deselectProject', projectName });
  }

  function selectProject(projectName: string) {
    depGraphService.send({ type: 'selectProject', projectName });
  }

  function focusProject(projectName: string) {
    depGraphService.send({ type: 'focusProject', projectName });
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
          ></SubProjectList>
        );
      })}
    </div>
  );
}

export default ProjectList;
