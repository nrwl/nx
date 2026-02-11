import { relative, resolve } from 'path';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { readNxJson } from '../../config/configuration';
import type { NxJsonConfiguration } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import {
  getDependencyConfigs,
  getOutputsForTargetAndConfiguration,
} from '../../tasks-runner/utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { output } from '../../utils/output';
import { splitTarget } from '../../utils/split-target';
import { workspaceRoot } from '../../utils/workspace-root';
import { ShowTargetOptions } from './command-object';

// ── Shared utilities ─────────────────────────────────────────────────

let _pc: typeof import('picocolors');
function pc() {
  return (_pc ??= require('picocolors'));
}

async function flushOutput() {
  await new Promise((res) => setImmediate(res));
  await output.drain();
}

function printList(header: string, items: unknown[], prefix = '\n') {
  if (items.length === 0) return;
  console.log(`${prefix}${pc().bold(header)}:`);
  for (const item of items) console.log(`  ${item}`);
}

function outputJson(data: Record<string, unknown>) {
  console.log(JSON.stringify(data, null, 2));
}

/** Strips entries whose values are empty arrays from an object. */
function omitEmptyArrays<T extends Record<string, unknown>>(obj: T): T {
  const result = {} as T;
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length === 0) continue;
    (result as Record<string, unknown>)[k] = v;
  }
  return result;
}

/**
 * Categorizes flat hash plan entries (e.g. "file:src/main.ts", "env:CI")
 * returned by the HashPlanInspector into typed buckets.
 */
function categorizeHashPlan(entries: string[]) {
  const files: string[] = [];
  const environmentVariables: string[] = [];
  const runtimeInputs: string[] = [];
  const externalDependencies: string[] = [];

  for (const entry of entries) {
    if (entry.startsWith('file:')) files.push(entry.slice(5));
    else if (entry.startsWith('env:'))
      environmentVariables.push(entry.slice(4));
    else if (entry.startsWith('runtime:')) runtimeInputs.push(entry.slice(8));
    else if (
      entry.endsWith(':ProjectConfiguration') ||
      entry.endsWith(':TsConfig') ||
      entry.startsWith('cwd:')
    ) {
      // Implicit inputs — already shown in base display
    } else {
      externalDependencies.push(entry);
    }
  }

  return { files, environmentVariables, runtimeInputs, externalDependencies };
}

// ── Entry point ──────────────────────────────────────────────────────

export async function showTargetHandler(
  args: ShowTargetOptions
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

  const graph = await createProjectGraphAsync();
  const nxJson = readNxJson();

  const { projectName, targetName, configurationName } =
    resolveTargetIdentifier(args, graph, nxJson);

  const node = resolveProjectNode(projectName, graph);
  const targetConfig = node.data.targets?.[targetName];

  if (!targetConfig) {
    const availableTargets = Object.keys(node.data.targets ?? {});
    output.error({
      title: `Target "${targetName}" not found for project "${projectName}".`,
      bodyLines: availableTargets.length
        ? [`Available targets:`, ...availableTargets.map((t) => `  - ${t}`)]
        : [`This project has no targets configured.`],
    });
    process.exit(1);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    const availableConfigs = Object.keys(targetConfig.configurations ?? {});
    if (!availableConfigs.includes(configuration)) {
      output.error({
        title: `Configuration "${configuration}" not found for target "${projectName}:${targetName}".`,
        bodyLines: availableConfigs.length
          ? [
              `Available configurations:`,
              ...availableConfigs.map((c) => `  - ${c}`),
            ]
          : [`This target has no configurations.`],
      });
      process.exit(1);
    }
  }

  // --inputs and --check-input both use the HashPlanInspector
  if (args.inputs || args.checkInput !== undefined) {
    const inputFiles = await resolveInputFiles(
      projectName,
      targetName,
      configuration,
      graph,
      nxJson
    );

    if (args.inputs) {
      renderInputs(
        { project: projectName, target: targetName, ...inputFiles },
        args
      );
      await flushOutput();
      return;
    }

    // --check-input
    const data = resolveCheckFromFiles(
      args.checkInput,
      projectName,
      targetName,
      inputFiles.files
    );
    renderCheckInput(data, args);
    await flushOutput();
    process.exitCode ||=
      data.isInput || data.containedInputFiles.length ? 0 : 1;
    return;
  }

  if (args.outputs) {
    const data = resolveOutputsData(
      projectName,
      targetName,
      configuration,
      node
    );
    renderOutputs(data, args);
    return;
  }

  if (args.checkOutput !== undefined) {
    const data = resolveCheckOutputData(
      args.checkOutput,
      projectName,
      targetName,
      configuration,
      node
    );
    renderCheckOutput(data, args);
    process.exitCode ||=
      data.matchedOutput ||
      data.containedOutputPaths.length ||
      data.containedExpandedOutputs.length
        ? 0
        : 1;
    return;
  }

  const data = resolveTargetInfoData(
    projectName,
    targetName,
    configuration,
    node,
    graph,
    nxJson
  );
  renderTargetInfo(data, args);
  await flushOutput();
}

// ── Target identifier & project resolution ───────────────────────────

function resolveTargetIdentifier(
  args: ShowTargetOptions,
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
): { projectName: string; targetName: string; configurationName?: string } {
  if (!args.target) {
    output.error({
      title: 'No target specified.',
      bodyLines: [
        `Please specify a target using:`,
        `  nx show target <project:target>`,
        `  nx show target <target>  (infers project from cwd)`,
      ],
    });
    process.exit(1);
  }

  const [project, target, config] = splitTarget(args.target, graph);

  if (project && target) {
    return {
      projectName: project,
      targetName: target,
      configurationName: config,
    };
  }

  const targetName = project; // splitTarget returns the string as the first element
  const projectName = calculateDefaultProjectName(
    process.cwd(),
    workspaceRoot,
    readProjectsConfigurationFromProjectGraph(graph),
    nxJson
  );

  if (!projectName) {
    output.error({
      title: `Could not infer project from the current working directory.`,
      bodyLines: [
        `Please specify the project explicitly:`,
        `  nx show target ${projectName ?? '<project>'}:${targetName}`,
        ``,
        `Or run this command from within a project directory.`,
      ],
    });
    process.exit(1);
  }

  return { projectName, targetName };
}

function resolveProjectNode(projectName: string, graph: ProjectGraph) {
  let node = graph.nodes[projectName];
  if (!node) {
    const projects = findMatchingProjects([projectName], graph.nodes);
    if (projects.length === 1) {
      node = graph.nodes[projects[0]];
    } else if (projects.length > 1) {
      output.error({
        title: `Multiple projects matched "${projectName}":`,
        bodyLines:
          projects.length > 100 ? [...projects.slice(0, 100), '...'] : projects,
      });
      process.exit(1);
    } else {
      output.error({
        title: `Could not find project "${projectName}".`,
      });
      process.exit(1);
    }
  }
  return node;
}

// ── Data resolvers ───────────────────────────────────────────────────

function resolveTargetInfoData(
  projectName: string,
  targetName: string,
  configuration: string | undefined,
  node: ProjectGraph['nodes'][string],
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
) {
  const targetConfig = node.data.targets[targetName];

  const baseOptions = targetConfig.options ?? {};
  const configOptions = configuration
    ? (targetConfig.configurations?.[configuration] ?? {})
    : {};

  const allTargetNames = new Set<string>();
  for (const n of Object.values(graph.nodes)) {
    for (const t of Object.keys(n.data.targets ?? {})) {
      allTargetNames.add(t);
    }
  }

  const extraTargetDeps = Object.fromEntries(
    Object.entries(nxJson.targetDefaults ?? {})
      .filter(([, config]) => config.dependsOn)
      .map(([name, config]) => [name, config.dependsOn])
  );

  const depConfigs = getDependencyConfigs(
    { project: projectName, target: targetName },
    extraTargetDeps,
    graph,
    [...allTargetNames]
  );

  const configurations = Object.keys(targetConfig.configurations ?? {});

  const command =
    targetConfig.metadata?.scriptContent ??
    targetConfig.options?.command ??
    (targetConfig.options?.commands?.length === 1
      ? targetConfig.options.commands[0]
      : undefined);

  const dependsOn =
    depConfigs && depConfigs.length > 0
      ? depConfigs.map((dep) => ({
          target: dep.target,
          projects: resolveDependencyProjects(dep, projectName, graph),
          ...(dep.params ? { params: dep.params } : {}),
        }))
      : undefined;

  return {
    project: projectName,
    target: targetName,
    ...(configuration ? { configuration } : {}),
    executor: targetConfig.executor,
    ...(command ? { command } : {}),
    options: { ...baseOptions, ...configOptions } as Record<string, unknown>,
    ...(targetConfig.inputs ? { inputs: targetConfig.inputs } : {}),
    ...(targetConfig.outputs
      ? { outputs: targetConfig.outputs as string[] }
      : {}),
    ...(dependsOn ? { dependsOn } : {}),
    ...(configurations.length > 0 ? { configurations } : {}),
    ...(targetConfig.defaultConfiguration
      ? { defaultConfiguration: targetConfig.defaultConfiguration }
      : {}),
    cache: targetConfig.cache ?? false,
    parallelism: targetConfig.parallelism ?? true,
  };
}

/**
 * Uses the HashPlanInspector (native hash planner) to resolve the complete
 * set of inputs that affect a task's cache hash.  Returns categorized inputs:
 * files, environment variables, runtime inputs, and external dependencies.
 */
async function resolveInputFiles(
  projectName: string,
  targetName: string,
  configuration: string | undefined,
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
) {
  const { HashPlanInspector } = (await import(
    '../../hasher/hash-plan-inspector'
  )) as typeof import('../../hasher/hash-plan-inspector');
  const inspector = new HashPlanInspector(graph, workspaceRoot, nxJson);
  await inspector.init();

  const plan = inspector.inspectTask({
    project: projectName,
    target: targetName,
    configuration,
  });

  const taskId = `${projectName}:${targetName}`;
  const entries = plan[taskId] ?? [];

  return categorizeHashPlan(entries);
}

function resolveCheckFromFiles(
  rawFileToCheck: string,
  projectName: string,
  targetName: string,
  inputFiles: string[]
) {
  const fileToCheck = normalizePath(rawFileToCheck);
  const isInput = inputFiles.includes(fileToCheck);

  let containedInputFiles: string[] = [];
  if (!isInput) {
    const dirPrefix = fileToCheck.endsWith('/')
      ? fileToCheck
      : fileToCheck + '/';
    containedInputFiles = inputFiles.filter((f) => f.startsWith(dirPrefix));
  }

  return {
    file: fileToCheck,
    project: projectName,
    target: targetName,
    isInput,
    containedInputFiles,
  };
}

function resolveOutputsData(
  projectName: string,
  targetName: string,
  configuration: string | undefined,
  node: ProjectGraph['nodes'][string]
) {
  const resolvedOutputs = getOutputsForTargetAndConfiguration(
    { project: projectName, target: targetName, configuration },
    {},
    node
  );

  let expandedOutputs: string[];
  try {
    const { expandOutputs } = require('../../native');
    expandedOutputs = expandOutputs(workspaceRoot, resolvedOutputs);
  } catch {
    expandedOutputs = resolvedOutputs;
  }

  return {
    project: projectName,
    target: targetName,
    outputPaths: resolvedOutputs,
    expandedOutputs,
  };
}

function resolveCheckOutputData(
  rawFileToCheck: string,
  projectName: string,
  targetName: string,
  configuration: string | undefined,
  node: ProjectGraph['nodes'][string]
) {
  const fileToCheck = normalizePath(rawFileToCheck);
  const resolvedOutputs = getOutputsForTargetAndConfiguration(
    { project: projectName, target: targetName, configuration },
    {},
    node
  );

  const normalizedFile = fileToCheck.replace(/\\/g, '/');

  // Expand globs to actual files on disk
  let expandedOutputs: string[];
  try {
    const { expandOutputs } = require('../../native');
    expandedOutputs = expandOutputs(workspaceRoot, resolvedOutputs);
  } catch {
    expandedOutputs = resolvedOutputs;
  }

  // Check if the file is an output — try configured paths first (prefix match
  // covers directory outputs), then fall back to expanded outputs (handles globs).
  let matchedOutput: string | null = null;
  for (const outputPath of resolvedOutputs) {
    const normalizedOutput = outputPath.replace(/\\/g, '/');
    if (
      normalizedFile === normalizedOutput ||
      normalizedFile.startsWith(normalizedOutput + '/')
    ) {
      matchedOutput = outputPath;
      break;
    }
  }
  if (!matchedOutput && expandedOutputs.includes(normalizedFile)) {
    matchedOutput = normalizedFile;
  }

  // If the path isn't directly an output, check if it's a directory containing outputs
  let containedOutputPaths: string[] = [];
  let containedExpandedOutputs: string[] = [];
  if (!matchedOutput) {
    const dirPrefix = normalizedFile.endsWith('/')
      ? normalizedFile
      : normalizedFile + '/';

    containedOutputPaths = resolvedOutputs.filter((o) =>
      o.replace(/\\/g, '/').startsWith(dirPrefix)
    );
    containedExpandedOutputs = expandedOutputs.filter((o) =>
      o.replace(/\\/g, '/').startsWith(dirPrefix)
    );
  }

  return {
    file: fileToCheck,
    project: projectName,
    target: targetName,
    matchedOutput,
    containedOutputPaths,
    containedExpandedOutputs,
  };
}

// ── Renderers ────────────────────────────────────────────────────────

function renderTargetInfo(
  data: ReturnType<typeof resolveTargetInfoData>,
  args: ShowTargetOptions
) {
  if (args.json) {
    outputJson(data as Record<string, unknown>);
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Target')}: ${c.cyan(data.project)}:${c.green(data.target)}`
  );
  if (data.executor) console.log(`${c.bold('Executor')}: ${data.executor}`);
  if (data.command) console.log(`${c.bold('Command')}: ${data.command}`);
  if (data.configuration)
    console.log(`${c.bold('Configuration')}: ${data.configuration}`);

  if (Object.keys(data.options).length > 0) {
    console.log(`${c.bold('Options')}:`);
    for (const [key, value] of Object.entries(data.options)) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  if (data.inputs && data.inputs.length > 0) {
    console.log(`${c.bold('Inputs')}:`);
    for (const input of data.inputs) {
      console.log(
        `  - ${typeof input === 'string' ? input : JSON.stringify(input)}`
      );
    }
  }

  if (data.outputs && data.outputs.length > 0) {
    console.log(`${c.bold('Outputs')}:`);
    for (const o of data.outputs) console.log(`  - ${o}`);
  }

  if (data.dependsOn && data.dependsOn.length > 0) {
    console.log(`${c.bold('Depends On')}:`);
    for (const dep of data.dependsOn) {
      console.log(`  ${dep.target} → ${dep.projects.join(', ')}`);
    }
  }

  if (data.configurations && data.configurations.length > 0) {
    console.log(
      `${c.bold('Configurations')}: ${data.configurations.join(', ')}${
        data.defaultConfiguration
          ? ` (default: ${data.defaultConfiguration})`
          : ''
      }`
    );
  }

  console.log(`${c.bold('Cache')}: ${data.cache}`);
  console.log(`${c.bold('Parallelism')}: ${data.parallelism}`);
}

function renderInputs(
  data: ReturnType<typeof categorizeHashPlan> & {
    project: string;
    target: string;
  },
  args: ShowTargetOptions
) {
  if (args.json) {
    outputJson(omitEmptyArrays(data as Record<string, unknown>));
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Inputs for')} ${c.cyan(data.project)}:${c.green(data.target)}`
  );
  printList(`Files (${data.files.length})`, data.files);
  printList('Environment variables', data.environmentVariables);
  printList('Runtime inputs', data.runtimeInputs);
  printList('External dependencies', data.externalDependencies);
}

function renderCheckInput(
  data: ReturnType<typeof resolveCheckFromFiles>,
  args: ShowTargetOptions
) {
  if (args.json) {
    const result: Record<string, unknown> = {
      file: data.file,
      project: data.project,
      target: data.target,
      isInput: data.isInput,
    };
    if (data.containedInputFiles.length > 0) {
      result.isDirectoryContainingInputs = true;
      result.containedInputFiles = data.containedInputFiles;
    }
    outputJson(result);
    return;
  }

  const c = pc();
  if (data.isInput) {
    console.log(
      `${c.green('✓')} ${c.bold(data.file)} is an input for ${c.cyan(
        data.project
      )}:${c.green(data.target)}`
    );
  } else if (data.containedInputFiles.length > 0) {
    console.log(
      `${c.yellow('~')} ${c.bold(data.file)} is a directory containing ${c.bold(
        String(data.containedInputFiles.length)
      )} input file(s) for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
    for (const f of data.containedInputFiles) console.log(`  ${f}`);
  } else {
    console.log(
      `${c.red('✗')} ${c.bold(data.file)} is ${c.red(
        'not'
      )} an input for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
  }
}

function renderOutputs(
  data: ReturnType<typeof resolveOutputsData>,
  args: ShowTargetOptions
) {
  if (args.json) {
    outputJson(data as Record<string, unknown>);
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Output paths for')} ${c.cyan(data.project)}:${c.green(
      data.target
    )}`
  );

  if (data.outputPaths.length > 0) {
    printList('Configured outputs', data.outputPaths);
  }
  if (
    data.expandedOutputs.length > 0 &&
    data.expandedOutputs !== data.outputPaths
  ) {
    printList('Expanded files', data.expandedOutputs);
  }
  if (data.outputPaths.length === 0) {
    console.log(`\n  No outputs configured for this target.`);
  }
}

function renderCheckOutput(
  data: ReturnType<typeof resolveCheckOutputData>,
  args: ShowTargetOptions
) {
  const isDirectoryContainingOutputs =
    data.containedOutputPaths.length > 0 ||
    data.containedExpandedOutputs.length > 0;

  if (args.json) {
    const result: Record<string, unknown> = {
      file: data.file,
      isOutput: data.matchedOutput !== null,
      matchedOutput: data.matchedOutput,
      project: data.project,
      target: data.target,
    };
    if (isDirectoryContainingOutputs) {
      result.isDirectoryContainingOutputs = true;
      if (data.containedOutputPaths.length > 0)
        result.containedOutputPaths = data.containedOutputPaths;
      if (data.containedExpandedOutputs.length > 0)
        result.containedExpandedOutputs = data.containedExpandedOutputs;
    }
    outputJson(result);
    return;
  }

  const c = pc();
  if (data.matchedOutput) {
    console.log(
      `${c.green('✓')} ${c.bold(data.file)} is an output of ${c.cyan(
        data.project
      )}:${c.green(data.target)}`
    );
  } else if (isDirectoryContainingOutputs) {
    const totalCount =
      data.containedOutputPaths.length + data.containedExpandedOutputs.length;
    console.log(
      `${c.yellow('~')} ${c.bold(data.file)} is a directory containing ${c.bold(
        String(totalCount)
      )} output path(s) for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
    printList('Configured outputs', data.containedOutputPaths, '\n');
    printList('Expanded output files', data.containedExpandedOutputs);
  } else {
    console.log(
      `${c.red('✗')} ${c.bold(data.file)} is ${c.red(
        'not'
      )} an output of ${c.cyan(data.project)}:${c.green(data.target)}`
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

function resolveDependencyProjects(
  dep: { target: string; dependencies?: boolean; projects?: string[] },
  projectName: string,
  graph: ProjectGraph
): string[] {
  if (dep.projects && dep.projects.length > 0) return dep.projects;
  if (dep.dependencies) {
    const depEdges = graph.dependencies[projectName] ?? [];
    return depEdges
      .filter((edge) => {
        const depNode = graph.nodes[edge.target];
        return depNode && depNode.data.targets?.[dep.target];
      })
      .map((edge) => edge.target);
  }
  return [projectName];
}

/**
 * Converts a user-provided path into a workspace-relative path for comparison
 * against project file maps.
 */
function normalizePath(p: string): string {
  const absolute = resolve(workspaceRoot, p);
  return relative(workspaceRoot, absolute).replace(/\\/g, '/');
}
