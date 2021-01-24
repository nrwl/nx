import { runCommand } from '../tasks-runner/run-command';
import { createProjectGraph, ProjectGraph } from '../core/project-graph';
import { readEnvironment } from '../core/file-utils';
import { EmptyReporter } from '../tasks-runner/empty-reporter';
import { splitArgsIntoNxArgsAndOverrides } from './utils';
import { projectHasTarget } from '../utilities/project-graph-utils';
import { promptForNxCloud } from './prompt-for-nx-cloud';

export async function runOne(opts: {
  project: string;
  target: string;
  configuration: string;
  parsedArgs: any;
}) {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    {
      ...opts.parsedArgs,
      configuration: opts.configuration,
      target: opts.target,
    },
    'run-one'
  );

  await promptForNxCloud(nxArgs.scan);

  const projectGraph = createProjectGraph();
  const { projects, projectsMap } = getProjects(
    projectGraph,
    nxArgs.withDeps,
    opts.project,
    opts.target
  );
  const env = readEnvironment(opts.target, projectsMap);
  const reporter = nxArgs.withDeps
    ? new (require(`../tasks-runner/run-one-reporter`).RunOneReporter)(
        opts.project
      )
    : new EmptyReporter();

  runCommand(
    projects,
    projectGraph,
    env,
    nxArgs,
    overrides,
    reporter,
    opts.project
  );
}

function getProjects(
  projectGraph: ProjectGraph,
  includeDeps: boolean,
  project: string,
  target: string
): any {
  let projects = [projectGraph.nodes[project]];
  let projectsMap = {
    [project]: projectGraph.nodes[project],
  };

  if (includeDeps) {
    const s = require(`../core/project-graph`);
    const deps = s.onlyWorkspaceProjects(s.withDeps(projectGraph, projects))
      .nodes;
    const projectsWithTarget = Object.values(deps).filter((p: any) =>
      projectHasTarget(p, target)
    );
    return {
      projects: projectsWithTarget,
      projectsMap: deps,
    };
  } else {
    return { projects, projectsMap };
  }
}
