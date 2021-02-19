import * as yargs from 'yargs';
import { filterAffected } from '../core/affected-project-graph';
import { calculateFileChanges, readEnvironment } from '../core/file-utils';
import {
  createProjectGraph,
  onlyWorkspaceProjects,
  ProjectGraphNode,
  ProjectType,
  withDeps,
} from '../core/project-graph';
import { DefaultReporter } from '../tasks-runner/default-reporter';
import { runCommand } from '../tasks-runner/run-command';
import { output } from '../utilities/output';
import { projectHasTarget } from '../utilities/project-graph-utils';
import { generateGraph } from './dep-graph';
import { printAffected } from './print-affected';
import { promptForNxCloud } from './prompt-for-nx-cloud';
import { parseFiles } from './shared';
import { NxArgs, RawNxArgs, splitArgsIntoNxArgsAndOverrides } from './utils';

export async function affected(
  command: 'apps' | 'libs' | 'dep-graph' | 'print-affected' | 'affected',
  parsedArgs: yargs.Arguments & RawNxArgs
) {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'affected',
    {
      printWarnings: command !== 'print-affected' && !parsedArgs.plain,
    }
  );

  await promptForNxCloud(nxArgs.scan);

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
  const projectsNotExcluded = Object.keys(projects)
    .filter((key) => !parsedArgs.exclude.includes(key))
    .reduce((p, key) => {
      p[key] = projects[key];
      return p;
    }, {} as Record<string, ProjectGraphNode>);
  const env = readEnvironment(nxArgs.target, projectsNotExcluded);
  const affectedProjects = Object.values(projectsNotExcluded).filter(
    (n) => !parsedArgs.onlyFailed || !env.workspaceResults.getResult(n.name)
  );

  try {
    switch (command) {
      case 'apps':
        const apps = affectedProjects
          .filter((p) => p.type === ProjectType.app)
          .map((p) => p.name);
        if (parsedArgs.plain) {
          console.log(apps.join(' '));
        } else {
          if (apps.length) {
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map((app) => `${output.colors.gray('-')} ${app}`),
            });
          }
        }
        break;

      case 'libs':
        const libs = affectedProjects
          .filter((p) => p.type === ProjectType.lib)
          .map((p) => p.name);
        if (parsedArgs.plain) {
          console.log(libs.join(' '));
        } else {
          if (libs.length) {
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map((lib) => `${output.colors.gray('-')} ${lib}`),
            });
          }
        }
        break;

      case 'dep-graph':
        const projectNames = affectedProjects.map((p) => p.name);
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
            env,
            nxArgs,
            overrides
          );
        } else {
          printAffected(
            [],
            affectedProjects,
            projectGraph,
            env,
            nxArgs,
            overrides
          );
        }
        break;

      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(
          affectedProjects,
          nxArgs
        );
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
