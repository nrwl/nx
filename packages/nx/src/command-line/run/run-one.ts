import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { readNxJson } from '../../config/configuration';
import { handleImport } from '../../utils/handle-import';
import { NxJsonConfiguration } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { runCommand } from '../../tasks-runner/run-command';
import {
  readGraphFileFromGraphArg,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { output } from '../../utils/output';
import { splitTarget } from '../../utils/split-target';
import {
  findClosestMatches,
  levenshteinDistance,
} from '../../utils/string-similarity';
import { workspaceRoot } from '../../utils/workspace-root';
import { generateGraph } from '../graph/graph';
import { connectToNxCloudIfExplicitlyAsked } from '../nx-cloud/connect/connect-to-nx-cloud';

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

  const { projects, projectName } = getProjects(
    projectGraph,
    opts.project,
    opts.target,
    opts.configuration
  );

  const targetError = getRunOneTargetError(
    projects[0],
    opts.target,
    opts.configuration
  );
  if (targetError) {
    output.error(targetError);
    process.exit(1);
  }

  if (nxArgs.help) {
    await (
      await handleImport('./run.js', __dirname)
    ).printTargetRunHelp(
      {
        ...opts,
        project: projectName,
      },
      workspaceRoot
    );
    process.exit(0);
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

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
  projectName: string,
  target: string,
  configuration?: string
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

  output.error(
    getCannotFindProjectError(projectGraph, projectName, target, configuration)
  );
  process.exit(1);
}

// Keep error output scannable: only show a handful of targets/suggestions.
const MAX_LISTED_TARGETS = 5;
const MAX_SUGGESTIONS = 3;

/**
 * Builds the list of all runnable `project:target` task ids in the workspace,
 * used to suggest the right invocation when a project or target can't be found.
 */
function getProjectTargetIds(projectGraph: ProjectGraph): string[] {
  const ids: string[] = [];
  for (const projectName of Object.keys(projectGraph.nodes)) {
    const targets = projectGraph.nodes[projectName].data.targets ?? {};
    for (const targetName of Object.keys(targets)) {
      ids.push(`${projectName}:${targetName}`);
    }
  }
  return ids;
}

/**
 * A target (and even a configuration) name can legally contain ':'. When the
 * user typos such a name, `splitTarget` splits on every ':' and parses the
 * trailing segment(s) as separate parts (e.g. `nx:zzcustom:variantt` becomes
 * project `nx`, target `zzcustom`, configuration `variantt`).
 *
 * To match the real name we therefore try the fully-rejoined specifier first,
 * then progressively shorter forms. Rejoining wins for colon-containing names,
 * while the shorter forms keep matching genuine `target` + `configuration`
 * typos (where the real target name does not carry the configuration suffix).
 */
function findClosestSpecifier(
  parts: (string | undefined)[],
  candidates: readonly string[],
  limit = 1
): string[] {
  const present = parts.filter((part): part is string => !!part);
  for (let end = present.length; end >= 1; end--) {
    const matches = findClosestMatches(
      present.slice(0, end).join(':'),
      candidates,
      limit
    );
    if (matches.length) {
      return matches;
    }
  }
  return [];
}

/**
 * Lists up to `MAX_LISTED_TARGETS` targets, ordered by how closely they resemble
 * the target the user typed (closest first, ties broken alphabetically) so the
 * most likely intended targets surface first. `closestMatch` is omitted because
 * it is already surfaced separately as the "Did you mean" suggestion. Appends a
 * "...and N more" line when the project has more targets than we show.
 */
function formatAvailableTargets(
  availableTargets: string[],
  target: string,
  closestMatch?: string
): string[] {
  const sorted = availableTargets
    .filter((t) => t !== closestMatch)
    .map((t) => ({ target: t, distance: levenshteinDistance(target, t) }))
    .sort((a, b) => a.distance - b.distance || a.target.localeCompare(b.target))
    .map(({ target }) => target);
  const shown = sorted.slice(0, MAX_LISTED_TARGETS);
  const lines = ['Available targets:', ...shown.map((t) => `  - ${t}`)];
  if (sorted.length > shown.length) {
    lines.push(`  ...and ${sorted.length - shown.length} more`);
  }
  return lines;
}

/**
 * Builds the error shown when the project itself can't be found. Matches the
 * attempted `project:target[:configuration]` against every runnable task id so
 * a project typo (e.g. `webpai:build`) still surfaces the intended task
 * (`webapi:build`).
 */
export function getCannotFindProjectError(
  projectGraph: ProjectGraph,
  projectName: string,
  target: string,
  configuration?: string
): { title: string; bodyLines: string[] } {
  const bodyLines: string[] = [];
  const suggestions = findClosestSpecifier(
    [projectName, target, configuration],
    getProjectTargetIds(projectGraph),
    MAX_SUGGESTIONS
  );
  if (suggestions.length) {
    bodyLines.push(
      'Did you mean one of these?',
      ...suggestions.map((id) => `  - ${id}`)
    );
  }

  return {
    title: `Cannot find project '${projectName}'`,
    bodyLines,
  };
}

/**
 * Validates that `target` exists on the resolved project. When it does not,
 * returns an error describing the available targets (and the closest match, if
 * any) so the user can recover from a typo or discover what they can run.
 */
export function getRunOneTargetError(
  project: ProjectGraphProjectNode,
  target: string,
  configuration?: string
): { title: string; bodyLines: string[] } | null {
  const availableTargets = Object.keys(project.data.targets ?? {});
  if (availableTargets.includes(target)) {
    return null;
  }

  const bodyLines: string[] = [];
  const [closestMatch] = findClosestSpecifier(
    [target, configuration],
    availableTargets
  );
  if (closestMatch) {
    bodyLines.push(`Did you mean "${closestMatch}"?`, '');
  }

  if (availableTargets.length) {
    bodyLines.push(
      ...formatAvailableTargets(availableTargets, target, closestMatch)
    );
  } else {
    bodyLines.push(
      `The project "${project.name}" does not have any targets configured.`
    );
  }

  return {
    title: `Cannot find target "${target}" for project "${project.name}"`,
    bodyLines,
  };
}

const targetAliases = {
  b: 'build',
  e: 'e2e',
  l: 'lint',
  s: 'serve',
  t: 'test',
};

const PROJECT_TARGET_CONFIG = 'project:target:configuration';

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

  if (
    typeof parsedArgs[PROJECT_TARGET_CONFIG] === 'string' &&
    parsedArgs[PROJECT_TARGET_CONFIG].lastIndexOf(':') > 0
  ) {
    // run case
    [project, target, configuration] = splitTarget(
      parsedArgs[PROJECT_TARGET_CONFIG],
      projectGraph,
      { currentProject: defaultProjectName }
    );
    // this is to account for "nx npmscript:dev"
    if (project && !target && defaultProjectName) {
      target = project;
      project = defaultProjectName;
    }
  } else if (parsedArgs.target) {
    target = parsedArgs.target;
  } else if (typeof parsedArgs[PROJECT_TARGET_CONFIG] === 'string') {
    // If project:target:configuration exists but has no colon, check if it's a project with run target
    if (
      projectGraph.nodes[parsedArgs[PROJECT_TARGET_CONFIG]]?.data?.targets?.run
    ) {
      target = 'run';
      project = parsedArgs[PROJECT_TARGET_CONFIG];
    } else {
      target = parsedArgs[PROJECT_TARGET_CONFIG];
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
  delete parsedArgs[PROJECT_TARGET_CONFIG];
  delete parsedArgs['configuration'];
  delete parsedArgs['prod'];
  delete parsedArgs['project'];

  return res;
}
