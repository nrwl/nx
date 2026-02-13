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
import type {
  ShowTargetBaseOptions,
  ShowTargetInputsOptions,
  ShowTargetOutputsOptions,
} from './command-object';
import type { HashInputs } from '../../native';

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

// ── Entry points ─────────────────────────────────────────────────────

export async function showTargetInfoHandler(
  args: ShowTargetBaseOptions
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
    reportTargetNotFound(projectName, targetName, node);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    validateConfiguration(projectName, targetName, configuration, targetConfig);
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

export async function showTargetInputsHandler(
  args: ShowTargetInputsOptions
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
    reportTargetNotFound(projectName, targetName, node);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    validateConfiguration(projectName, targetName, configuration, targetConfig);
  }

  const hashInputs = await resolveInputFiles(
    projectName,
    targetName,
    configuration,
    graph,
    nxJson
  );

  if (args.check !== undefined) {
    const data = resolveCheckFromInputs(
      args.check,
      projectName,
      targetName,
      hashInputs
    );
    renderCheckInput(data, args);
    await flushOutput();
    process.exitCode ||=
      data.isInput || data.containedInputFiles.length ? 0 : 1;
    return;
  }

  renderInputs(
    { project: projectName, target: targetName, ...hashInputs },
    args
  );
  await flushOutput();
}

export async function showTargetOutputsHandler(
  args: ShowTargetOutputsOptions
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
    reportTargetNotFound(projectName, targetName, node);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    validateConfiguration(projectName, targetName, configuration, targetConfig);
  }

  if (args.check !== undefined) {
    const data = resolveCheckOutputData(
      args.check,
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

  const data = resolveOutputsData(projectName, targetName, configuration, node);
  renderOutputs(data, args);
}

// ── Target identifier & project resolution ───────────────────────────

function resolveTargetIdentifier(
  args: ShowTargetBaseOptions,
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

function reportTargetNotFound(
  projectName: string,
  targetName: string,
  node: ProjectGraph['nodes'][string]
): never {
  const availableTargets = Object.keys(node.data.targets ?? {});
  output.error({
    title: `Target "${targetName}" not found for project "${projectName}".`,
    bodyLines: availableTargets.length
      ? [`Available targets:`, ...availableTargets.map((t) => `  - ${t}`)]
      : [`This project has no targets configured.`],
  });
  process.exit(1);
}

function validateConfiguration(
  projectName: string,
  targetName: string,
  configuration: string,
  targetConfig: any
): void {
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
      ? depConfigs.flatMap((dep) => {
          const projects = resolveDependencyProjects(dep, projectName, graph);
          return projects.map((p) => `${p}:${dep.target}`);
        })
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
 * set of inputs that affect a task's cache hash. Returns structured HashInputs
 * with files, runtime, environment, depOutputs, and external arrays.
 */
async function resolveInputFiles(
  projectName: string,
  targetName: string,
  configuration: string | undefined,
  graph: ProjectGraph,
  nxJson: NxJsonConfiguration
): Promise<HashInputs> {
  const { HashPlanInspector } = (await import(
    '../../hasher/hash-plan-inspector'
  )) as typeof import('../../hasher/hash-plan-inspector');
  const inspector = new HashPlanInspector(graph, workspaceRoot, nxJson);
  await inspector.init();

  const plan = inspector.inspectTaskInputs({
    project: projectName,
    target: targetName,
    configuration,
  });

  const taskId = `${projectName}:${targetName}`;
  return (
    plan[taskId] ?? {
      files: [],
      runtime: [],
      environment: [],
      depOutputs: [],
      external: [],
    }
  );
}

function resolveCheckFromInputs(
  rawValue: string,
  projectName: string,
  targetName: string,
  inputs: HashInputs
) {
  // Check non-file categories first (exact match on raw value)
  const isEnvironment = inputs.environment.includes(rawValue);
  const isRuntime = inputs.runtime.includes(rawValue);
  const isExternal = inputs.external.includes(rawValue);
  const isDepOutput = inputs.depOutputs.includes(rawValue);

  if (isEnvironment || isRuntime || isExternal || isDepOutput) {
    const matchedCategory = isEnvironment
      ? 'environment'
      : isRuntime
        ? 'runtime'
        : isExternal
          ? 'external'
          : 'depOutputs';
    return {
      value: rawValue,
      file: rawValue,
      project: projectName,
      target: targetName,
      isInput: true,
      matchedCategory,
      containedInputFiles: [] as string[],
    };
  }

  // Check files (with directory matching)
  const fileToCheck = normalizePath(rawValue);
  const isFile = inputs.files.includes(fileToCheck);

  let containedInputFiles: string[] = [];
  if (!isFile) {
    const dirPrefix = fileToCheck.endsWith('/')
      ? fileToCheck
      : fileToCheck + '/';
    containedInputFiles = inputs.files.filter((f) => f.startsWith(dirPrefix));
  }

  return {
    value: rawValue,
    file: fileToCheck,
    project: projectName,
    target: targetName,
    isInput: isFile,
    matchedCategory: isFile
      ? 'files'
      : containedInputFiles.length > 0
        ? 'files'
        : (null as string | null),
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

  // Detect outputs containing {options.*} that were dropped because the
  // referenced option is not set. getOutputsForTargetAndConfiguration silently
  // omits these — the resolved list will have fewer entries than configured.
  const targetConfig = node.data.targets?.[targetName];
  const configuredOutputs: string[] = targetConfig?.outputs ?? [];
  const mergedOptions = {
    ...targetConfig?.options,
    ...(configuration
      ? targetConfig?.configurations?.[configuration]
      : undefined),
  };
  const unresolvedOutputs = configuredOutputs.filter((o) => {
    if (!/\{options\./.test(o)) return false;
    // Check if every {options.*} token in this template has a value
    const unresolved = o.match(/\{options\.([^}]+)\}/g);
    return unresolved?.some((token) => {
      const key = token.slice('{options.'.length, -1);
      return mergedOptions[key] === undefined;
    });
  });

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
    unresolvedOutputs,
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
  args: ShowTargetBaseOptions
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
    for (const taskId of data.dependsOn) {
      console.log(`  ${taskId}`);
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
  data: HashInputs & {
    project: string;
    target: string;
  },
  args: ShowTargetInputsOptions
) {
  if (args.json) {
    outputJson(omitEmptyArrays(data as unknown as Record<string, unknown>));
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Inputs for')} ${c.cyan(data.project)}:${c.green(data.target)}`
  );
  printList(`Files (${data.files.length})`, data.files);
  printList('Environment variables', data.environment);
  printList('Runtime inputs', data.runtime);
  printList('Dependent task outputs', data.depOutputs);
  printList('External dependencies', data.external);
}

function renderCheckInput(
  data: ReturnType<typeof resolveCheckFromInputs>,
  args: ShowTargetInputsOptions
) {
  if (args.json) {
    const result: Record<string, unknown> = {
      value: data.value,
      project: data.project,
      target: data.target,
      isInput: data.isInput,
    };
    if (data.matchedCategory) {
      result.matchedCategory = data.matchedCategory;
    }
    if (data.containedInputFiles.length > 0) {
      result.isDirectoryContainingInputs = true;
      result.containedInputFiles = data.containedInputFiles;
    }
    outputJson(result);
    return;
  }

  const c = pc();
  const categoryLabel = data.matchedCategory
    ? ` (${data.matchedCategory})`
    : '';
  if (data.isInput) {
    console.log(
      `${c.green('✓')} ${c.bold(data.value)} is an input for ${c.cyan(
        data.project
      )}:${c.green(data.target)}${categoryLabel}`
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
      `${c.red('✗')} ${c.bold(data.value)} is ${c.red(
        'not'
      )} an input for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
  }
}

function renderOutputs(
  data: ReturnType<typeof resolveOutputsData>,
  args: ShowTargetOutputsOptions
) {
  if (args.json) {
    outputJson(omitEmptyArrays(data as unknown as Record<string, unknown>));
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
    printList('Expanded outputs', data.expandedOutputs);
  }
  if (data.unresolvedOutputs.length > 0) {
    printList(
      `${c.yellow('Unresolved outputs')} (option not set)`,
      data.unresolvedOutputs
    );
  }
  if (data.outputPaths.length === 0 && data.unresolvedOutputs.length === 0) {
    console.log(`\n  No outputs configured for this target.`);
  }
}

function renderCheckOutput(
  data: ReturnType<typeof resolveCheckOutputData>,
  args: ShowTargetOutputsOptions
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
    // Deduplicate across configured and expanded to avoid inflated counts
    const uniquePaths = new Set([
      ...data.containedOutputPaths,
      ...data.containedExpandedOutputs,
    ]);
    console.log(
      `${c.yellow('~')} ${c.bold(data.file)} is a directory containing ${c.bold(
        String(uniquePaths.size)
      )} output path(s) for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
    printList('Configured outputs', data.containedOutputPaths, '\n');
    // Only show expanded outputs that aren't already in configured outputs
    const extraExpanded = data.containedExpandedOutputs.filter(
      (o) => !data.containedOutputPaths.includes(o)
    );
    printList('Expanded outputs', extraExpanded);
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
