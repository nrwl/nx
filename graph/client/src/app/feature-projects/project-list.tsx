import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  EyeIcon,
  FlagIcon,
  MapPinIcon,
  ViewfinderCircleIcon,
} from '@heroicons/react/24/outline';
import type {
  ProjectUINode,
  CompositeProjectUINode,
  ProjectGraphHandleEventResult,
} from '@nx/graph/projects';
import { useProjectGraphSelector } from './hooks/use-project-graph-selector';
import {
  getTracingInfo,
  workspaceLayoutSelector,
  compositeGraphEnabledSelector,
} from './machines/selectors';
import {
  getProjectUINodesByType,
  groupProjectUINodesByDirectory,
  SidebarProjectUINode,
  SidebarCompositeUINode,
} from '../util';
import { ExperimentalFeature } from '../ui-components/experimental-feature';
import { TracingAlgorithmType } from './machines/interfaces';
import { getProjectGraphService } from '../machines/get-services';
import { Link, useNavigate } from 'react-router-dom';
import { useRouteConstructor } from '@nx/graph-shared';
import { useCompositeNodeSelectionContext } from '@nx/graph/dialogs';

interface TracingInfo {
  start: string;
  end: string;
  algorithm: TracingAlgorithmType;
}

function ProjectListItemV2({
  project,
  tracingInfo,
}: {
  project: SidebarProjectUINode;
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
      projectGraphService.send({
        type: 'excludeNode',
        nodeIds: [project.projectUINode.id],
      });
    } else {
      projectGraphService.send({
        type: 'includeNode',
        nodeIds: [project.projectUINode.id],
        variant: 'legacy',
      });
    }
    navigate(routeConstructor('/projects', true));
  }

  return (
    <li className="relative block cursor-default select-none py-1 pl-2 pr-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <Link
          data-cy={`focus-button-${project.projectUINode.name}`}
          className="mr-1 flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
          title="Focus on this library"
          to={routeConstructor(
            `/projects/${encodeURIComponent(project.projectUINode.name)}`,
            true
          )}
        >
          <ViewfinderCircleIcon className="h-5 w-5" />
        </Link>

        <ExperimentalFeature>
          <span className="relative z-0 inline-flex rounded-md shadow-sm">
            <button
              type="button"
              title="Start Trace"
              onClick={() => startTrace(project.projectUINode.name)}
              className={`${
                tracingInfo.start === project.projectUINode.name
                  ? 'ring-blue-500 dark:ring-sky-500'
                  : 'ring-slate-200 dark:ring-slate-600'
              } flex items-center rounded-l-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700`}
            >
              <MapPinIcon className="h-5 w-5" />
            </button>

            <button
              type="button"
              title="End Trace"
              onClick={() => endTrace(project.projectUINode.name)}
              className={`${
                tracingInfo.end === project.projectUINode.name
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
          data-project={project.projectUINode.name}
          title={project.projectUINode.name}
          data-active={project.isSelected.toString()}
          onClick={() =>
            toggleProject(project.projectUINode.name, project.isSelected)
          }
        >
          {project.projectUINode.name}
        </label>
      </div>

      {project.isSelected ? (
        <span
          title="This library is visible"
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-blue-500 dark:text-sky-500"
          onClick={() =>
            toggleProject(project.projectUINode.name, project.isSelected)
          }
        >
          <EyeIcon className="h-5 w-5" />
        </span>
      ) : null}
    </li>
  );
}

function SubProjectListV2({
  headerText = '',
  projects,
  tracingInfo,
}: {
  headerText: string;
  projects: SidebarProjectUINode[];
  tracingInfo: TracingInfo;
}) {
  const projectGraphService = getProjectGraphService();

  let sortedProjects = [...projects];
  sortedProjects.sort((a, b) => {
    return a.projectUINode.name.localeCompare(b.projectUINode.name);
  });

  function toggleAllProjects(currentlySelected: boolean) {
    const projectIds = projects.map((project) => project.projectUINode.id);

    if (currentlySelected) {
      projectGraphService.send({ type: 'excludeNode', nodeIds: projectIds });
    } else {
      projectGraphService.send({
        type: 'includeNode',
        nodeIds: projectIds,
        variant: 'legacy',
      });
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
            <EyeIcon className="h-5 w-5" />
          </span>
        </div>
      ) : null}
      <ul className="-ml-3 mt-2">
        {sortedProjects.map((project) => {
          return (
            <ProjectListItemV2
              key={project.projectUINode.name}
              project={project}
              tracingInfo={tracingInfo}
            />
          );
        })}
      </ul>
    </>
  );
}

function CompositeNodeListItemV2({
  compositeNode,
  compositeNodes,
}: {
  compositeNode: SidebarCompositeUINode;
  compositeNodes: SidebarCompositeUINode[];
}) {
  const projectGraphService = getProjectGraphService();
  const routeConstructor = useRouteConstructor();
  const navigate = useNavigate();
  const { handleCompositeNodeExpand } = useCompositeNodeSelectionContext();

  // Find parent name if there's a parentId
  const parentName = compositeNode.compositeUINode.parentId
    ? compositeNodes.find(
        (node) =>
          node.compositeUINode.id === compositeNode.compositeUINode.parentId
      )?.compositeUINode.name
    : undefined;

  const label = parentName
    ? `${parentName}/${compositeNode.compositeUINode.name}`
    : compositeNode.compositeUINode.name;

  function toggleProject() {
    if (compositeNode.isSelected) {
      projectGraphService.send({
        type: 'excludeNode',
        nodeIds: [compositeNode.compositeUINode.id],
      });
    } else {
      projectGraphService.send({
        type: 'includeNode',
        nodeIds: [compositeNode.compositeUINode.id],
        variant: 'legacy',
      });
    }
    navigate(routeConstructor('/projects', true));
  }

  function toggleExpansion() {
    const isExpanded =
      compositeNode.compositeUINode.metadata.lastSelectedNodeIds !== undefined;

    if (isExpanded) {
      projectGraphService.send({
        type: 'collapseCompositeNode',
        compositeNodeId: compositeNode.compositeUINode.id,
      });
    } else {
      handleCompositeNodeExpand(compositeNode.compositeUINode.metadata);
    }
  }

  const isExpanded =
    compositeNode.compositeUINode.metadata.lastSelectedNodeIds !== undefined;

  return (
    <li className="relative block cursor-default select-none py-1 pl-2 pr-6 text-xs text-slate-600 dark:text-slate-400">
      <div className="flex items-center">
        <button
          className="mr-1 flex items-center rounded-md border-slate-300 bg-white p-1 font-medium text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-600 hover:dark:bg-slate-700"
          onClick={toggleExpansion}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? (
            <ArrowsPointingInIcon className="h-5 w-5" />
          ) : (
            <ArrowsPointingOutIcon className="h-5 w-5" />
          )}
        </button>

        <label
          className="ml-2 block w-full cursor-pointer truncate rounded-md p-2 font-mono font-normal transition hover:bg-slate-50 hover:dark:bg-slate-700"
          data-project={compositeNode.compositeUINode.id}
          title={label}
          data-active={compositeNode.isSelected}
          onClick={toggleProject}
        >
          {label}
        </label>
      </div>

      {compositeNode.isSelected ? (
        <span
          title="This node is visible"
          className="absolute inset-y-0 right-0 flex cursor-pointer items-center text-blue-500 dark:text-sky-500"
          onClick={toggleProject}
        >
          <EyeIcon className="h-5 w-5"></EyeIcon>
        </span>
      ) : null}
    </li>
  );
}

function CompositeNodeListV2({
  compositeNodes,
}: {
  compositeNodes: SidebarCompositeUINode[];
}) {
  if (compositeNodes.length === 0) {
    return <p>No composite nodes</p>;
  }

  return (
    <ul className="-ml-3 mt-2">
      {compositeNodes.map((node) => {
        return (
          <CompositeNodeListItemV2
            key={node.compositeUINode.id}
            compositeNode={node}
            compositeNodes={compositeNodes}
          />
        );
      })}
    </ul>
  );
}

export function ProjectList({
  handleEventResult,
}: {
  handleEventResult: ProjectGraphHandleEventResult;
}) {
  // Keep tracing info from selector as specified
  const tracingInfo = useProjectGraphSelector(getTracingInfo);
  const workspaceLayout = useProjectGraphSelector(workspaceLayoutSelector);
  const compositeGraphEnabled = useProjectGraphSelector(
    compositeGraphEnabledSelector
  );

  // Extract projects and composites from handleEventResult
  const allProjectUINodes = handleEventResult.nodes.filter(
    (node): node is ProjectUINode => node.type === 'project'
  );

  const allCompositeUINodes = handleEventResult.nodes.filter(
    (node): node is CompositeProjectUINode => node.type === 'composite-project'
  );

  // Get rendered projects for selection state
  const renderedProjectNames = handleEventResult.projects.map((p) => p.name);
  const renderedCompositeNames = handleEventResult.composites.map(
    (c) => c.name
  );
  const selectedProjects = [...renderedProjectNames, ...renderedCompositeNames];

  // Use new utility functions
  const appProjects = getProjectUINodesByType('app', allProjectUINodes);
  const libProjects = getProjectUINodesByType('lib', allProjectUINodes);
  const e2eProjects = getProjectUINodesByType('e2e', allProjectUINodes);

  const appDirectoryGroups = groupProjectUINodesByDirectory(
    appProjects,
    selectedProjects,
    workspaceLayout
  );
  const libDirectoryGroups = groupProjectUINodesByDirectory(
    libProjects,
    selectedProjects,
    workspaceLayout
  );
  const e2eDirectoryGroups = groupProjectUINodesByDirectory(
    e2eProjects,
    selectedProjects,
    workspaceLayout
  );

  // Filter composite nodes to only show rendered ones
  const renderedCompositeUINodes = allCompositeUINodes.filter(
    (node) => node.rendered
  );

  // Further filter to ensure parent composite nodes are also rendered
  const visibleCompositeUINodes = renderedCompositeUINodes.filter((node) => {
    // If no parent, it's a top-level node - always visible
    if (!node.parentId) {
      return true;
    }

    // If has parent, ensure parent is also in the rendered list
    return renderedCompositeUINodes.some(
      (parent) => parent.id === node.parentId
    );
  });

  // Convert filtered composite nodes to sidebar format
  const compositeNodes: SidebarCompositeUINode[] = visibleCompositeUINodes.map(
    (node) => ({
      compositeUINode: node,
      isSelected: selectedProjects.includes(node.name),
    })
  );

  const sortedAppDirectories = Object.keys(appDirectoryGroups).sort();
  const sortedLibDirectories = Object.keys(libDirectoryGroups).sort();
  const sortedE2EDirectories = Object.keys(e2eDirectoryGroups).sort();

  return (
    <div
      id="project-lists-v2"
      className="mt-8 border-t border-slate-400/10 px-4"
    >
      {compositeGraphEnabled ? (
        <>
          <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
            composite nodes
          </h2>
          <CompositeNodeListV2 compositeNodes={compositeNodes} />
        </>
      ) : null}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        app projects
      </h2>

      {sortedAppDirectories.map((directoryName) => {
        return (
          <SubProjectListV2
            key={'app-' + directoryName}
            headerText={directoryName}
            projects={appDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          />
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        e2e projects
      </h2>

      {sortedE2EDirectories.map((directoryName) => {
        return (
          <SubProjectListV2
            key={'e2e-' + directoryName}
            headerText={directoryName}
            projects={e2eDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          />
        );
      })}

      <h2 className="mt-8 border-b border-solid border-slate-200/10 text-lg font-light text-slate-400 dark:text-slate-500">
        lib projects
      </h2>

      {sortedLibDirectories.map((directoryName) => {
        return (
          <SubProjectListV2
            key={'lib-' + directoryName}
            headerText={directoryName}
            projects={libDirectoryGroups[directoryName]}
            tracingInfo={tracingInfo}
          />
        );
      })}
    </div>
  );
}
