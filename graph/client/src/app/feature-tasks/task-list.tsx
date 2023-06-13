/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import {
  createTaskName,
  getProjectsByType,
  groupProjectsByDirectory,
} from '../util';
import { WorkspaceLayout } from '../interfaces';
import { ExclamationCircleIcon, EyeIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';
import { Tooltip } from '@nx/graph/ui-tooltips';
import { TaskGraphErrorTooltip } from './task-graph-error-tooltip';

interface SidebarProject {
  projectGraphNode: ProjectGraphProjectNode;
  isSelected: boolean;
  error: string | null;
}

function ProjectListItem({
  project,
  toggleTask,
}: {
  project: SidebarProject;
  toggleTask: (taskId: string) => void;
}) {
  return (
    <li className="relative block cursor-default select-none pb-0 pl-2 pr-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <label
          className="block w-full cursor-pointer truncate rounded-md p-2 font-mono font-normal transition hover:bg-slate-50 hover:dark:bg-slate-700"
          data-project={project.projectGraphNode.name}
          title={project.projectGraphNode.name}
          data-active={project.isSelected.toString()}
          onClick={() =>
            !project.error ? toggleTask(project.projectGraphNode.name) : null
          }
        >
          {project.projectGraphNode.name}
        </label>
      </div>

      {project.error ? (
        <Tooltip
          content={(<TaskGraphErrorTooltip error={project.error} />) as any}
          openAction="click"
          strategy="fixed"
        >
          <span className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-blue-500 dark:text-sky-500">
            <ExclamationCircleIcon
              className="h-5 w-5 text-yellow-500 dark:text-yellow-400"
              aria-hidden="true"
            />
          </span>
        </Tooltip>
      ) : null}

      {project.isSelected ? (
        <span
          title="This task is visible"
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-blue-500 dark:text-sky-500"
          onClick={() => toggleTask(project.projectGraphNode.name)}
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
  toggleTask,
}: {
  headerText: string;
  projects: SidebarProject[];
  toggleTask: (taskId: string) => void;
}) {
  let sortedProjects = [...projects];
  sortedProjects.sort((a, b) => {
    return a.projectGraphNode.name.localeCompare(b.projectGraphNode.name);
  });

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
              toggleTask={toggleTask}
            ></ProjectListItem>
          );
        })}
      </ul>
    </>
  );
}

function mapToSidebarProjectWithTasks(
  project: ProjectGraphProjectNode,
  selectedProjects: string[],
  selectedTarget: string,
  errors: Record<string, string>
): SidebarProject {
  const taskId = createTaskName(project.name, selectedTarget);

  return {
    projectGraphNode: project,
    isSelected: selectedProjects.includes(project.name),
    error: errors?.[taskId] ?? null,
  };
}

export interface TaskListProps {
  projects: ProjectGraphProjectNode[];
  workspaceLayout: WorkspaceLayout;
  selectedTarget: string;
  selectedProjects: string[];
  toggleProject: (projectName: string) => void;
  children: ReactNode | ReactNode[];
  errors: Record<string, string>;
}

export function TaskList({
  projects,
  workspaceLayout,
  selectedTarget,
  selectedProjects,
  toggleProject,
  children,
  errors,
}: TaskListProps) {
  const filteredProjects = projects
    .filter((project) =>
      (project.data as any).targets?.hasOwnProperty(selectedTarget)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const appProjects = getProjectsByType('app', filteredProjects);
  const libProjects = getProjectsByType('lib', filteredProjects);
  const e2eProjects = getProjectsByType('e2e', filteredProjects);

  const appDirectoryGroups = groupProjectsByDirectory(
    appProjects,
    workspaceLayout
  );
  const libDirectoryGroups = groupProjectsByDirectory(
    libProjects,
    workspaceLayout
  );
  const e2eDirectoryGroups = groupProjectsByDirectory(
    e2eProjects,
    workspaceLayout
  );

  const sortedAppDirectories = Object.keys(appDirectoryGroups).sort();
  const sortedLibDirectories = Object.keys(libDirectoryGroups).sort();
  const sortedE2EDirectories = Object.keys(e2eDirectoryGroups).sort();

  return (
    <div id="project-lists" className="mt-8 border-t border-slate-400/10 px-4">
      {children}
      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        app projects
      </h2>

      {sortedAppDirectories.map((directoryName) => {
        return (
          <SubProjectList
            key={'app-' + directoryName}
            headerText={directoryName}
            projects={appDirectoryGroups[directoryName].map((project) =>
              mapToSidebarProjectWithTasks(
                project,
                selectedProjects,
                selectedTarget,
                errors
              )
            )}
            toggleTask={toggleProject}
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
            projects={e2eDirectoryGroups[directoryName].map((project) =>
              mapToSidebarProjectWithTasks(
                project,
                selectedProjects,
                selectedTarget,
                errors
              )
            )}
            toggleTask={toggleProject}
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
            projects={libDirectoryGroups[directoryName].map((project) =>
              mapToSidebarProjectWithTasks(
                project,
                selectedProjects,
                selectedTarget,
                errors
              )
            )}
            toggleTask={toggleProject}
          ></SubProjectList>
        );
      })}
    </div>
  );
}
