import { runCommand } from '../../tasks-runner/run-command';
import {
  readGraphFileFromGraphArg,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { connectToNxCloudIfExplicitlyAsked } from '../connect/connect-to-nx-cloud';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import { workspaceRoot } from '../../utils/workspace-root';
import { splitTarget } from '../../utils/split-target';
import { output } from '../../utils/output';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readNxJson } from '../../config/configuration';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { generateGraph } from '../graph/graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';

export async function runOne(
  cwd: string,
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
  } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

  const nxJson = readNxJson();
  const projectGraph = await createProjectGraphAsync();

  const opts = parseRunOneOptions(cwd, args, projectGraph, nxJson);

  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    {
      ...opts.parsedArgs,
      configuration: opts.configuration,
      targets: [opts.target],
    },
    'run-one',
    { printWarnings: args.graph !== 'stdout' },
    nxJson
  );

  if (nxArgs.help) {
    await (await import('./run')).printTargetRunHelp(opts, workspaceRoot);
    process.exit(0);
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const { projects, projectName } = getProjects(projectGraph, opts.project);

  if (nxArgs.graph) {
    const projectNames = projects.map((t) => t.name);
    const file = readGraphFileFromGraphArg(nxArgs);

    return await generateGraph(
      {
        watch: true,
        open: true,
        view: 'tasks',
        targets: nxArgs.targets,
        projects: projectNames,
        file,
      },
      projectNames
    );
  } else {
    const status = await runCommand(
      projects,
      projectGraph,
      { nxJson },
      nxArgs,
      overrides,
      projectName,
      extraTargetDependencies,
      extraOptions
    );
    process.exit(status);
  }
}

function getProjects(
  projectGraph: ProjectGraph,
  projectName: string
): {
  projectName: string;
  projects: ProjectGraphProjectNode[];
  projectsMap: Record<string, ProjectGraphProjectNode>;
} {
  if (projectGraph.nodes[projectName]) {
    return {
      projectName: projectName,
      projects: [projectGraph.nodes[projectName]],
      projectsMap: {
        [projectName]: projectGraph.nodes[projectName],
      },
    };
  } else {
    const projects = findMatchingProjects([projectName], projectGraph.nodes);
    if (projects.length === 1) {
      const projectName = projects[0];
      const project = projectGraph.nodes[projectName];
      return {
        projectName,
        projects: [project],
        projectsMap: {
          [project.data.name]: project,
        },
      };
    } else if (projects.length > 1) {
      output.error({
        title: `Multiple projects matched:`,
        bodyLines:
          projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
      });
      process.exit(1);
    }
  }

  output.error({
    title: `Cannot find project '${projectName}'`,
  });
  process.exit(1);
}

const targetAliases = {
  b: 'build',
  e: 'e2e',
  l: 'lint',
  s: 'serve',
  t: 'test',
};

export function parseRunOneOptions(
  cwd: string,
  parsedArgs: { [k: string]: any },
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): { project; target; configuration; parsedArgs } {
  const defaultProjectName = calculateDefaultProjectName(
    cwd,
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(projectGraph),
    nxJson
  );

  let project;
  let target;
  let configuration;

  if (parsedArgs['project:target:configuration']?.indexOf(':') > -1) {
    // run case
    [project, target, configuration] = splitTarget(
      parsedArgs['project:target:configuration'],
      projectGraph
    );
    // this is to account for "nx npmsript:dev"
    if (project && !target && defaultProjectName) {
      target = project;
      project = defaultProjectName;
    }
  } else if (parsedArgs.target) {
    target = parsedArgs.target;
  } else if (parsedArgs['project:target:configuration']) {
    // If project:target:configuration exists but has no colon, check if it's a project with run target
    if (
      projectGraph.nodes[parsedArgs['project:target:configuration']]?.data
        ?.targets?.run
    ) {
      target = 'run';
      project = parsedArgs['project:target:configuration'];
    } else {
      target = parsedArgs['project:target:configuration'];
    }
  }
  if (parsedArgs.project) {
    project = parsedArgs.project;
  }
  if (!project && defaultProjectName) {
    project = defaultProjectName;
  }

  if (!project || !target) {
    throw new Error(`Both project and target have to be specified`);
  }
  if (targetAliases[target]) {
    target = targetAliases[target];
  }
  if (parsedArgs.configuration) {
    configuration = parsedArgs.configuration;
  } else if (parsedArgs.prod) {
    configuration = 'production';
  }

  const res = { project, target, configuration, parsedArgs };
  delete parsedArgs['c'];
  delete parsedArgs['project:target:configuration'];
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
