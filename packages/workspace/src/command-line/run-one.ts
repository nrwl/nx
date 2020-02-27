import { runCommand } from '../tasks-runner/run-command';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraph,
  withDeps
} from '../core/project-graph';
import { readEnvironment } from '../core/file-utils';
import { EmptyReporter } from '../tasks-runner/empty-reporter';
import { splitArgsIntoNxArgsAndOverrides } from './utils';
import { DefaultReporter } from '../tasks-runner/default-reporter';

export function runOne(opts: {
  project: string;
  target: string;
  configuration: string;
  parsedArgs: any;
}): void {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    {
      ...opts.parsedArgs,
      configuration: opts.configuration,
      target: opts.target,
      _: []
    },
    'run-one'
  );

  const projectGraph = createProjectGraph();
  const { projects, projectsMap } = getProjects(
    projectGraph,
    nxArgs.withDeps,
    opts.project
  );
  const env = readEnvironment(opts.target, projectsMap);
  const reporter = nxArgs.withDeps
    ? new DefaultReporter()
    : new EmptyReporter();

  runCommand(projects, projectGraph, env, nxArgs, overrides, reporter);
}

function getProjects(
  projectGraph: ProjectGraph,
  includeDeps: boolean,
  project: string
) {
  let projects = [projectGraph.nodes[project]];
  let projectsMap = {
    [project]: projectGraph.nodes[project]
  };

  if (includeDeps) {
    const projectWithDeps = onlyWorkspaceProjects(
      withDeps(projectGraph, projects)
    ).nodes;
    return {
      projects: Object.values(projectWithDeps),
      projectsMap: projectWithDeps
    };
  } else {
    return { projects, projectsMap };
  }
}
