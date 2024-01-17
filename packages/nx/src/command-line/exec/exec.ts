import { execSync } from 'child_process';
import { join } from 'path';
import { exit } from 'process';
import * as yargs from 'yargs-parser';
import { Arguments } from 'yargs';
import { existsSync } from 'fs';

import { findMatchingProjects } from '../../utils/find-matching-projects';
import { readNxJson } from '../../config/configuration';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import {
  NxArgs,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { readJsonFile } from '../../utils/fileutils';
import { output } from '../../utils/output';
import { PackageJson } from '../../utils/package-json';
import { getPackageManagerCommand } from '../../utils/package-manager';
import { workspaceRoot } from '../../utils/workspace-root';
import { joinPathFragments } from '../../utils/path';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { getCommandProjects } from '../../commands-runner/get-command-projects';

export async function nxExecCommand(
  args: Record<string, string | string[] | boolean>
): Promise<unknown> {
  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: args.graph !== 'stdout' },
    nxJson
  );
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const scriptArgV: string[] = readScriptArgV(overrides);
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });

  // NX is already running
  if (process.env.NX_TASK_TARGET_PROJECT) {
    const command = scriptArgV
      .reduce((cmd, arg) => cmd + `"${arg}" `, '')
      .trim();
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_PROJECT_NAME: process.env.NX_TASK_TARGET_PROJECT,
        NX_PROJECT_ROOT_PATH:
          projectGraph.nodes?.[process.env.NX_TASK_TARGET_PROJECT]?.data?.root,
      },
    });
  } else {
    // nx exec is being ran inside of Nx's context
    return runScriptAsNxTarget(projectGraph, scriptArgV, nxArgs);
  }
}

async function runScriptAsNxTarget(
  projectGraph: ProjectGraph,
  argv: string[],
  nxArgs: NxArgs
) {
  // NPM, Yarn, and PNPM set this to the name of the currently executing script. Lets use it if we can.
  const targetName = process.env.npm_lifecycle_event;
  if (targetName) {
    const defaultPorject = getDefaultProject(projectGraph);
    const scriptDefinition = getScriptDefinition(targetName, defaultPorject);
    if (scriptDefinition) {
      runTargetOnProject(
        scriptDefinition,
        targetName,
        defaultPorject,
        defaultPorject.name,
        argv
      );
      return;
    }
  }

  const projects = getProjects(projectGraph, nxArgs);
  const projectsToRun: string[] = getCommandProjects(
    projectGraph,
    projects,
    nxArgs
  );
  projectsToRun.forEach((projectName) => {
    const command = argv.reduce((cmd, arg) => cmd + `"${arg}" `, '').trim();
    execSync(command, {
      stdio: 'inherit',
      env: {
        ...process.env,
        NX_PROJECT_NAME: projectGraph.nodes?.[projectName]?.name,
        NX_PROJECT_ROOT_PATH: projectGraph.nodes?.[projectName]?.data?.root,
      },
      cwd: projectGraph.nodes?.[projectName]?.data?.root
        ? joinPathFragments(
            workspaceRoot,
            projectGraph.nodes?.[projectName]?.data?.root
          )
        : workspaceRoot,
    });
  });
}

function runTargetOnProject(
  scriptDefinition: string,
  targetName: string,
  project: ProjectGraphProjectNode,
  projectName: string,
  argv: string[]
) {
  ensureNxTarget(project, targetName);

  // Get ArgV that is provided in npm script definition
  const providedArgs = yargs(scriptDefinition)._.slice(2);
  const extraArgs =
    providedArgs.length === argv.length ? [] : argv.slice(providedArgs.length);

  const pm = getPackageManagerCommand();
  // `targetName` might be an npm script with `:` like: `start:dev`, `start:debug`.
  const command = `${
    pm.exec
  } nx run ${projectName}:\\\"${targetName}\\\" ${extraArgs.join(' ')}`;
  execSync(command, { stdio: 'inherit' });
}

function readScriptArgV(
  overrides: Arguments & { __overrides_unparsed__: string[] }
) {
  const scriptSeparatorIdx = process.argv.findIndex((el) => el === '--');
  if (scriptSeparatorIdx === -1) {
    output.error({
      title: '`nx exec` requires passing in a command after `--`',
    });
    process.exit(1);
  }

  return overrides.__overrides_unparsed__;
}

function getScriptDefinition(
  targetName: string,
  project?: ProjectGraphProjectNode
): PackageJson['scripts'][string] {
  if (!project) {
    return;
  }
  const packageJsonPath = join(
    workspaceRoot,
    project.data.root,
    'package.json'
  );
  if (existsSync(packageJsonPath)) {
    const scriptDefinition =
      readJsonFile<PackageJson>(packageJsonPath).scripts?.[targetName];
    return scriptDefinition;
  }
}

function ensureNxTarget(project: ProjectGraphProjectNode, targetName: string) {
  if (!project.data.targets[targetName]) {
    output.error({
      title: `Nx cannot find a target called "${targetName}" for ${project.name}`,
      bodyLines: [
        `Is ${targetName} missing from ${project.data.root}/package.json's nx.includedScripts field?`,
      ],
    });
    exit(1);
  }
}

function getDefaultProject(
  projectGraph: ProjectGraph
): ProjectGraphProjectNode | undefined {
  const defaultProjectName = calculateDefaultProjectName(
    process.cwd(),
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(projectGraph),
    readNxJson()
  );
  if (defaultProjectName && projectGraph.nodes[defaultProjectName]) {
    return projectGraph.nodes[defaultProjectName];
  }
}

function getProjects(
  projectGraph: ProjectGraph,
  nxArgs: NxArgs
): ProjectGraphProjectNode[] {
  let selectedProjects = {};

  // get projects matched
  if (nxArgs.projects?.length) {
    const matchingProjects = findMatchingProjects(
      nxArgs.projects,
      projectGraph.nodes
    );
    for (const project of matchingProjects) {
      selectedProjects[project] = projectGraph.nodes[project];
    }
  } else {
    // if no project specified, return all projects
    selectedProjects = { ...projectGraph.nodes };
  }

  const excludedProjects = findMatchingProjects(
    nxArgs.exclude,
    selectedProjects
  );
  for (const excludedProject of excludedProjects) {
    delete selectedProjects[excludedProject];
  }

  return Object.values(selectedProjects);
}
