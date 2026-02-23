import { relative, resolve } from 'path';
import { calculateDefaultProjectName } from '../../config/calculate-default-project-name';
import { readNxJson } from '../../config/configuration';
import type { NxJsonConfiguration } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import type {
  InputDefinition,
  TargetConfiguration,
} from '../../config/workspace-json-project-json';
import type { HashInputs } from '../../native';
import {
  createProjectGraphAsync,
  readProjectsConfigurationFromProjectGraph,
} from '../../project-graph/project-graph';
import { getNamedInputs } from '../../hasher/task-hasher';
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
import { handleImport } from '../../utils/handle-import';

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
    return reportTargetNotFound(projectName, targetName, node);
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
}

export async function showTargetInputsHandler(
  args: ShowTargetInputsOptions
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

  const graph = await createProjectGraphAsync();
  const nxJson = readNxJson();

  const { projectName, targetName } = resolveTargetIdentifier(
    args,
    graph,
    nxJson
  );

  const node = resolveProjectNode(projectName, graph);
  const targetConfig = node.data.targets?.[targetName];

  if (!targetConfig) {
    return reportTargetNotFound(projectName, targetName, node);
  }

  const hashInputs = await resolveInputFiles(
    projectName,
    targetName,
    undefined,
    graph,
    nxJson
  );

  if (args.check !== undefined) {
    const checkItems = deduplicateFolderEntries(args.check);
    const results = checkItems.map((input) =>
      resolveCheckFromInputs(input, projectName, targetName, hashInputs)
    );

    if (results.length >= 2) {
      renderBatchCheckInputs(results, projectName, targetName);
    } else {
      for (const data of results) {
        renderCheckInput(data);
      }
    }

    for (const data of results) {
      process.exitCode ||=
        data.isInput || data.containedInputFiles.length ? 0 : 1;
    }
    return;
  }

  const configuredInputs = targetConfig.inputs;
  renderInputs(
    { project: projectName, target: targetName, ...hashInputs },
    configuredInputs,
    args
  );
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
    return reportTargetNotFound(projectName, targetName, node);
  }

  const configuration = configurationName ?? args.configuration;
  if (configuration) {
    validateConfiguration(projectName, targetName, configuration, targetConfig);
  }

  const outputsData = resolveOutputsData(
    projectName,
    targetName,
    configuration,
    node
  );

  if (args.check !== undefined) {
    const checkItems = deduplicateFolderEntries(args.check);
    const results = checkItems.map((output) =>
      resolveCheckOutputData(output, outputsData)
    );

    if (results.length >= 2) {
      renderBatchCheckOutputs(results, outputsData.project, outputsData.target);
    } else {
      for (const data of results) {
        renderCheckOutput(data);
      }
    }

    for (const data of results) {
      process.exitCode ||=
        data.matchedOutput ||
        data.containedOutputPaths.length ||
        data.containedExpandedOutputs.length
          ? 0
          : 1;
    }
    return;
  }

  renderOutputs(outputsData, args);
}

// ── Target identifier & project resolution ───────────────────────────

function resolveTargetIdentifier(
  args: ShowTargetBaseOptions | ShowTargetInputsOptions,
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
        `  nx show target <project>:${targetName}`,
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
  targetConfig: TargetConfiguration
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
    options: {
      ...targetConfig.options,
      ...(configuration
        ? targetConfig.configurations?.[configuration]
        : undefined),
    },
    ...(targetConfig.inputs
      ? { inputs: expandInputsForDisplay(targetConfig.inputs, node, nxJson) }
      : {}),
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
  const { HashPlanInspector } = (await handleImport(
    '../../hasher/hash-plan-inspector.js',
    __dirname
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

  // Resolve path relative to cwd for file checking
  const fileToCheck = normalizePath(rawValue);
  const isFile = inputs.files.includes(fileToCheck);

  let containedInputFiles: string[] = [];
  if (!isFile) {
    // Empty string means workspace root — all files are contained
    if (fileToCheck === '') {
      containedInputFiles = inputs.files;
    } else {
      const dirPrefix = fileToCheck.endsWith('/')
        ? fileToCheck
        : fileToCheck + '/';
      containedInputFiles = inputs.files.filter((f) => f.startsWith(dirPrefix));
    }
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
  outputsData: ReturnType<typeof resolveOutputsData>
) {
  const fileToCheck = normalizePath(rawFileToCheck);
  const { outputPaths, expandedOutputs } = outputsData;

  // Check if the file is an output — try configured paths first (prefix match
  // covers directory outputs), then fall back to expanded outputs (handles globs).
  let matchedOutput: string | null = null;
  for (const outputPath of outputPaths) {
    const normalizedOutput = outputPath.replace(/\\/g, '/');
    if (
      fileToCheck === normalizedOutput ||
      fileToCheck.startsWith(normalizedOutput + '/')
    ) {
      matchedOutput = outputPath;
      break;
    }
  }
  if (!matchedOutput && expandedOutputs.includes(fileToCheck)) {
    matchedOutput = fileToCheck;
  }

  // If the path isn't directly an output, check if it's a directory containing outputs
  let containedOutputPaths: string[] = [];
  let containedExpandedOutputs: string[] = [];
  if (!matchedOutput) {
    if (fileToCheck === '') {
      containedOutputPaths = [...outputPaths];
      containedExpandedOutputs = [...expandedOutputs];
    } else {
      const dirPrefix = fileToCheck.endsWith('/')
        ? fileToCheck
        : fileToCheck + '/';

      containedOutputPaths = outputPaths.filter((o) =>
        o.replace(/\\/g, '/').startsWith(dirPrefix)
      );
      containedExpandedOutputs = expandedOutputs.filter((o) =>
        o.replace(/\\/g, '/').startsWith(dirPrefix)
      );
    }
  }

  return {
    value: rawFileToCheck,
    file: fileToCheck,
    project: outputsData.project,
    target: outputsData.target,
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
    console.log(JSON.stringify(data, null, 2));
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
    const sortedInputs = [...data.inputs].sort((a, b) => {
      const aIsString = typeof a === 'string';
      const bIsString = typeof b === 'string';

      // Objects come after strings
      if (!aIsString && bIsString) return 1;
      if (aIsString && !bIsString) return -1;

      // Both are strings
      if (aIsString && bIsString) {
        const aIsDep = a.startsWith('^');
        const bIsDep = b.startsWith('^');

        // Dependency inputs (^) come after regular inputs
        if (aIsDep && !bIsDep) return 1;
        if (!aIsDep && bIsDep) return -1;

        return a < b ? -1 : a > b ? 1 : 0;
      }

      return 0;
    });
    for (const input of sortedInputs) {
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
  configuredInputs: TargetConfiguration['inputs'] | undefined,
  args: ShowTargetInputsOptions
) {
  if (args.json) {
    const jsonData = data as unknown as Record<string, unknown>;
    // Inline omitEmptyArrays
    const result = {} as Record<string, unknown>;
    for (const [k, v] of Object.entries(jsonData)) {
      if (Array.isArray(v) && v.length === 0) continue;
      result[k] = v;
    }
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const c = pc();
  console.log(
    `${c.bold('Inputs for')} ${c.cyan(data.project)}:${c.green(data.target)}`
  );

  // Show configured input groups (named inputs like "production", "^production")
  if (configuredInputs && configuredInputs.length > 0) {
    printList(
      'Configured inputs',
      configuredInputs.map((i) =>
        typeof i === 'string' ? i : JSON.stringify(i)
      )
    );
  }

  printList('External dependencies', [...data.external].sort());
  printList('Runtime inputs', [...data.runtime].sort());
  printList('Environment variables', [...data.environment].sort());
  printList(
    `Files (${data.files.length})`,
    [...data.files, ...data.depOutputs].sort()
  );
}

function renderCheckInput(data: ReturnType<typeof resolveCheckFromInputs>) {
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
    for (const f of [...data.containedInputFiles].sort()) console.log(`  ${f}`);
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
    // Inline omitEmptyArrays
    const jsonData = data as unknown as Record<string, unknown>;
    const result = {} as Record<string, unknown>;
    for (const [k, v] of Object.entries(jsonData)) {
      if (Array.isArray(v) && v.length === 0) continue;
      result[k] = v;
    }
    console.log(JSON.stringify(result, null, 2));
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

  if (data.expandedOutputs.length > 0) {
    printList('Resolved outputs', data.expandedOutputs);
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

function renderCheckOutput(data: ReturnType<typeof resolveCheckOutputData>) {
  const isDirectoryContainingOutputs =
    data.containedOutputPaths.length > 0 ||
    data.containedExpandedOutputs.length > 0;

  const c = pc();
  const displayPath = data.value || data.file;
  if (data.matchedOutput) {
    console.log(
      `${c.green('✓')} ${c.bold(displayPath)} is an output of ${c.cyan(
        data.project
      )}:${c.green(data.target)}`
    );
  } else if (isDirectoryContainingOutputs) {
    const uniquePaths = new Set([
      ...data.containedOutputPaths,
      ...data.containedExpandedOutputs,
    ]);
    console.log(
      `${c.yellow('~')} ${c.bold(displayPath)} is a directory containing ${c.bold(
        String(uniquePaths.size)
      )} output path(s) for ${c.cyan(data.project)}:${c.green(data.target)}`
    );
    // Only show expanded outputs (not configured paths) per review feedback
    const extraExpanded = data.containedExpandedOutputs.filter(
      (o) => !data.containedOutputPaths.includes(o)
    );
    if (extraExpanded.length > 0) {
      printList('Expanded outputs', extraExpanded);
    }
  } else {
    console.log(
      `${c.red('✗')} ${c.bold(displayPath)} is ${c.red(
        'not'
      )} an output of ${c.cyan(data.project)}:${c.green(data.target)}`
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Expands named inputs (e.g. "production", "default") to their definitions
 * so the user can see what each named input resolves to. Inputs prefixed
 * with "^" (dependency inputs) are kept as-is since they reference inputs
 * from dependent projects. Object-type inputs pass through unchanged.
 */
function expandInputsForDisplay(
  inputs: (InputDefinition | string)[],
  node: ProjectGraph['nodes'][string],
  nxJson: NxJsonConfiguration
): (InputDefinition | string)[] {
  const namedInputs = getNamedInputs(nxJson, node);
  const result: (InputDefinition | string)[] = [];

  for (const input of inputs) {
    if (typeof input === 'string') {
      if (input.startsWith('^')) {
        // Dependency input — keep as-is
        result.push(input);
      } else if (namedInputs[input]) {
        // Named input — expand inline
        result.push(...namedInputs[input]);
      } else {
        result.push(input);
      }
    } else if ('input' in input) {
      // Object with { input: "namedInput" } — expand the reference
      const name = input.input;
      if (!name.startsWith('^') && namedInputs[name]) {
        result.push(...namedInputs[name]);
      } else {
        result.push(input);
      }
    } else {
      result.push(input);
    }
  }

  return result;
}

/**
 * When shell glob expansion is used, both directories and files within
 * those directories may appear. Remove any directory entry whose children
 * are already present in the list.
 */
function deduplicateFolderEntries(items: string[]): string[] {
  const normalized = items.map((item) => ({
    original: item,
    path: normalizePath(item),
  }));

  return normalized
    .filter(({ path }) => {
      const dirPrefix = path.endsWith('/') ? path : path + '/';
      const hasChildInList = normalized.some(
        (other) => other.path !== path && other.path.startsWith(dirPrefix)
      );
      return !hasChildInList;
    })
    .map(({ original }) => original);
}

function renderBatchCheckInputs(
  results: ReturnType<typeof resolveCheckFromInputs>[],
  projectName: string,
  targetName: string
) {
  const matched: string[] = [];
  const directories: { value: string; count: number }[] = [];
  const unmatched: string[] = [];

  for (const data of results) {
    if (data.isInput) {
      matched.push(data.value);
    } else if (data.containedInputFiles.length > 0) {
      directories.push({
        value: data.file,
        count: data.containedInputFiles.length,
      });
    } else {
      unmatched.push(data.value);
    }
  }

  const c = pc();
  const label = `${c.cyan(projectName)}:${c.green(targetName)}`;

  if (matched.length > 0 || directories.length > 0) {
    console.log(`\n${c.green('✓')} These arguments were inputs for ${label}:`);
    for (const v of matched) console.log(`  ${v}`);
    for (const d of directories) {
      console.log(`  ${d.value} (directory containing ${d.count} input files)`);
    }
  }

  if (unmatched.length > 0) {
    console.log(
      `\n${c.red('✗')} These arguments were ${c.red(
        'not'
      )} inputs for ${label}:`
    );
    for (const v of unmatched) console.log(`  ${v}`);
  }
}

function renderBatchCheckOutputs(
  results: ReturnType<typeof resolveCheckOutputData>[],
  projectName: string,
  targetName: string
) {
  const matched: string[] = [];
  const directories: { value: string; count: number }[] = [];
  const unmatched: string[] = [];

  for (const data of results) {
    if (data.matchedOutput) {
      matched.push(data.value);
    } else if (
      data.containedOutputPaths.length > 0 ||
      data.containedExpandedOutputs.length > 0
    ) {
      const uniqueCount = new Set([
        ...data.containedOutputPaths,
        ...data.containedExpandedOutputs,
      ]).size;
      directories.push({ value: data.file, count: uniqueCount });
    } else {
      unmatched.push(data.value);
    }
  }

  const c = pc();
  const label = `${c.cyan(projectName)}:${c.green(targetName)}`;

  if (matched.length > 0 || directories.length > 0) {
    console.log(`\n${c.green('✓')} These arguments were outputs of ${label}:`);
    for (const v of matched) console.log(`  ${v}`);
    for (const d of directories) {
      console.log(
        `  ${d.value} (directory containing ${d.count} output paths)`
      );
    }
  }

  if (unmatched.length > 0) {
    console.log(
      `\n${c.red('✗')} These arguments were ${c.red(
        'not'
      )} outputs of ${label}:`
    );
    for (const v of unmatched) console.log(`  ${v}`);
  }
}

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
 * against project file maps. Resolves relative to process.cwd() so that
 * --check arguments work correctly from any directory.
 */
function normalizePath(p: string): string {
  const absolute = resolve(process.cwd(), p);
  return relative(workspaceRoot, absolute).replace(/\\/g, '/');
}

let _pc: typeof import('picocolors');
function pc() {
  return (_pc ??= require('picocolors'));
}

function printList(header: string, items: unknown[], prefix = '\n') {
  if (items.length === 0) return;
  console.log(`${prefix}${pc().bold(header)}:`);
  for (const item of items) console.log(`  ${item}`);
}
