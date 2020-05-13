import * as yargs from 'yargs';
import { generateGraph } from './dep-graph';
import { output } from '../utils/output';
import { parseFiles, printArgsWarning } from './shared';
import { runCommand } from '../tasks-runner/run-command';
import { NxArgs, splitArgsIntoNxArgsAndOverrides } from './utils';
import { filterAffected } from '../core/affected-project-graph';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraphNode,
  ProjectType,
  withDeps,
} from '../core/project-graph';
import { calculateFileChanges, readEnvironment } from '../core/file-utils';
import { printAffected } from './print-affected';
import { projectHasTarget } from '../utils/project-graph-utils';
import { DefaultReporter } from '../tasks-runner/default-reporter';

export function affected(command: string, parsedArgs: yargs.Arguments): void {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'affected'
  );

  const projectGraph = createProjectGraph();
  let affectedGraph = nxArgs.all
    ? projectGraph
    : filterAffected(
        projectGraph,
        calculateFileChanges(parseFiles(nxArgs).files, nxArgs)
      );
  if (parsedArgs.withDeps) {
    affectedGraph = onlyWorkspaceProjects(
      withDeps(projectGraph, Object.values(affectedGraph.nodes))
    );
  }
  const projects = parsedArgs.all ? projectGraph.nodes : affectedGraph.nodes;
  const env = readEnvironment(nxArgs.target, projects);
  const affectedProjects = Object.values(projects)
    .filter((n) => !parsedArgs.exclude.includes(n.name))
    .filter(
      (n) => !parsedArgs.onlyFailed || !env.workspaceResults.getResult(n.name)
    );

  try {
    switch (command) {
      case 'apps':
      case 'libs': {
        const projectTypeToFilter =
          command === 'apps' ? ProjectType.app : ProjectType.lib;

        const projects = affectedProjects.filter(
          (p) => p.type === projectTypeToFilter
        );

        if (parsedArgs.plain) {
          const affectedProjectsNames = projects.map((p) => p.name);
          console.log(affectedProjectsNames.join(' '));
        } else if (nxArgs.target) {
          const libsWithTarget = allProjectsWithTarget(projects, nxArgs);

          runCommand(
            libsWithTarget,
            projectGraph,
            env,
            nxArgs,
            overrides,
            new DefaultReporter(),
            null
          );
        } else {
          const affectedProjectsNames = projects.map((p) => p.name);

          printArgsWarning(nxArgs);
          if (affectedProjectsNames.length) {
            const title = `Affected ${command === 'apps' ? 'apps' : 'libs'}:`;
            output.log({
              title,
              bodyLines: affectedProjectsNames.map(
                (lib) => `${output.colors.gray('-')} ${lib}`
              ),
            });
          }
        }

        break;
      }

      case 'dep-graph':
        const projectNames = affectedProjects.map((p) => p.name);
        printArgsWarning(nxArgs);
        generateGraph(parsedArgs as any, projectNames);
        break;

      case 'print-affected':
        if (nxArgs.target) {
          const projectsWithTarget = allProjectsWithTarget(
            affectedProjects,
            nxArgs
          );
          printAffected(
            projectsWithTarget,
            affectedProjects,
            projectGraph,
            nxArgs,
            overrides
          );
        } else {
          printAffected([], affectedProjects, projectGraph, nxArgs, overrides);
        }
        break;

      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(
          affectedProjects,
          nxArgs
        );
        printArgsWarning(nxArgs);
        runCommand(
          projectsWithTarget,
          projectGraph,
          env,
          nxArgs,
          overrides,
          new DefaultReporter(),
          null
        );
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

function allProjectsWithTarget(projects: ProjectGraphNode[], nxArgs: NxArgs) {
  return projects.filter((p) => projectHasTarget(p, nxArgs.target));
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines,
  });
}
