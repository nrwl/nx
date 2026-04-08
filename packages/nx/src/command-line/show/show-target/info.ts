import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { InputDefinition } from '../../../config/workspace-json-project-json';
import type { ConfigurationSourceMaps } from '../../../project-graph/utils/project-configuration/source-maps';
import { getNamedInputs } from '../../../hasher/task-hasher';
import { getDependencyConfigs } from '../../../tasks-runner/utils';
import type { ShowTargetBaseOptions } from '../command-object';
import {
  resolveTarget,
  pc,
  hasCustomHasher,
  type ResolvedTarget,
} from './utils';

// ── Handler ─────────────────────────────────────────────────────────

export async function showTargetInfoHandler(
  args: ShowTargetBaseOptions
): Promise<void> {
  const t = await resolveTarget(args, { withSourceMaps: true });
  const data = resolveTargetInfoData(t);
  renderTargetInfo(data, args);
}

// ── Data resolution ─────────────────────────────────────────────────

export type TargetInfoData = ReturnType<typeof resolveTargetInfoData>;

interface ExpandedInput {
  value: InputDefinition | string;
  /** Index into the original target inputs array this was expanded from. */
  originalIndex: number;
}

function resolveTargetInfoData(t: ResolvedTarget) {
  const {
    projectName,
    targetName,
    configuration,
    node,
    graph,
    nxJson,
    sourceMaps,
  } = t;
  const targetConfig = node.data.targets[targetName];

  const allTargetNames = new Set<string>();
  for (const n of Object.values(graph.nodes)) {
    for (const name of Object.keys(n.data.targets ?? {})) {
      allTargetNames.add(name);
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

  // Determine the hoisted command value and which option key it came from
  let command: string | undefined;
  let commandSourceKey: string | undefined;
  if (targetConfig.metadata?.scriptContent) {
    command = targetConfig.metadata.scriptContent;
    commandSourceKey = 'options.script';
  } else if (targetConfig.options?.command) {
    command = targetConfig.options.command;
    commandSourceKey = 'options.command';
  } else if (targetConfig.options?.commands?.length === 1) {
    command = targetConfig.options.commands[0];
    commandSourceKey = 'options.commands';
  } else if (
    targetConfig.executor === 'nx:run-script' &&
    targetConfig.options?.script
  ) {
    command = targetConfig.options.script;
    commandSourceKey = 'options.script';
  }

  const dependsOn: string[] = [];
  const depSourceIndices: number[] = [];
  if (depConfigs && depConfigs.length > 0) {
    for (let i = 0; i < depConfigs.length; i++) {
      const dep = depConfigs[i];
      const projects = resolveDependencyProjects(dep, projectName, graph);
      for (const p of projects) {
        dependsOn.push(`${p}:${dep.target}`);
        depSourceIndices.push(i);
      }
    }
  }

  const configurations = Object.keys(targetConfig.configurations ?? {});
  const targetSourceMap = extractTargetSourceMap(
    node.data.root,
    targetName,
    sourceMaps
  );
  const usesCustomHasher = hasCustomHasher(projectName, targetName, graph);

  return {
    project: projectName,
    target: targetName,
    ...(configuration ? { configuration } : {}),
    executor: targetConfig.executor,
    ...(command ? { command, _commandSourceKey: commandSourceKey } : {}),
    ...(usesCustomHasher ? { customHasher: true } : {}),
    ...(dependsOn.length > 0
      ? { dependsOn, _depSources: depSourceIndices }
      : {}),
    parallelism: targetConfig.parallelism ?? true,
    continuous: targetConfig.continuous ?? false,
    cache: targetConfig.cache ?? false,
    ...(targetConfig.inputs
      ? (() => {
          const expanded = expandInputsForDisplay(
            targetConfig.inputs,
            node,
            nxJson
          );
          return {
            inputs: expanded.map((e) => e.value),
            _inputSources: expanded.map((e) => e.originalIndex),
          };
        })()
      : {}),
    ...(targetConfig.outputs
      ? { outputs: targetConfig.outputs as string[] }
      : {}),
    options: {
      ...targetConfig.options,
      ...(configuration
        ? targetConfig.configurations?.[configuration]
        : undefined),
    },
    ...(configurations.length > 0 ? { configurations } : {}),
    ...(targetConfig.defaultConfiguration
      ? { defaultConfiguration: targetConfig.defaultConfiguration }
      : {}),
    ...(targetSourceMap ? { sourceMap: targetSourceMap } : {}),
  };
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
 * Expands named inputs (e.g. "production") to their definitions while
 * tracking which original input index each expanded item came from.
 * This lets the renderer look up `inputs.${originalIndex}` in the source map.
 */
function expandInputsForDisplay(
  inputs: (InputDefinition | string)[],
  node: ProjectGraph['nodes'][string],
  nxJson: NxJsonConfiguration
): ExpandedInput[] {
  const namedInputs = getNamedInputs(nxJson, node);
  const result: ExpandedInput[] = [];

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    if (typeof input === 'string') {
      if (input.startsWith('^')) {
        result.push({ value: input, originalIndex: i });
      } else if (namedInputs[input]) {
        for (const expanded of namedInputs[input]) {
          result.push({ value: expanded, originalIndex: i });
        }
      } else {
        result.push({ value: input, originalIndex: i });
      }
    } else if ('input' in input) {
      const name = input.input;
      // Don't expand when the input has additional qualifiers (e.g. projects)
      // since those scopes are meaningful and would be lost by expansion
      const hasQualifiers = Object.keys(input).length > 1;
      if (!hasQualifiers && !name.startsWith('^') && namedInputs[name]) {
        for (const expanded of namedInputs[name]) {
          result.push({ value: expanded, originalIndex: i });
        }
      } else {
        result.push({ value: input, originalIndex: i });
      }
    } else {
      result.push({ value: input, originalIndex: i });
    }
  }

  return result;
}

function extractTargetSourceMap(
  projectRoot: string,
  targetName: string,
  sourceMaps?: ConfigurationSourceMaps
): Record<string, [file: string | null, plugin: string]> | undefined {
  if (!sourceMaps) return undefined;

  const projectSourceMap = sourceMaps[projectRoot];
  if (!projectSourceMap) return undefined;

  const prefix = `targets.${targetName}.`;
  const targetEntry = `targets.${targetName}`;
  const result: Record<string, [string | null, string]> = {};

  for (const [key, value] of Object.entries(projectSourceMap)) {
    if (key === targetEntry) {
      result['target'] = value;
    } else if (key.startsWith(prefix)) {
      result[key.slice(prefix.length)] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

// ── Render ──────────────────────────────────────────────────────────

function renderTargetInfo(data: TargetInfoData, args: ShowTargetBaseOptions) {
  if (args.json) {
    // Strip internal renderer-only fields from JSON output
    const { _inputSources, _depSources, _commandSourceKey, ...jsonData } = data;
    console.log(JSON.stringify(jsonData, null, 2));
    return;
  }

  const c = pc();
  const sm = data.sourceMap;

  const sourceHint = (key: string, fallbackKey?: string): string => {
    if (!args.verbose) return '';
    const entry = sm?.[key] ?? (fallbackKey ? sm?.[fallbackKey] : undefined);
    if (!entry) return '';
    const [file, plugin] = entry;
    if (file && plugin) return ` ${c.dim(`(from ${file} by ${plugin})`)}`;
    if (file) return ` ${c.dim(`(from ${file})`)}`;
    if (plugin) return ` ${c.dim(`(by ${plugin})`)}`;
    return '';
  };

  console.log(
    `${c.bold('Target')}: ${c.cyan(data.project)}:${c.green(data.target)}${sourceHint('target')}`
  );

  if (data.command) {
    const label = data.executor === 'nx:run-script' ? 'Script' : 'Command';
    const cmdHint = data._commandSourceKey
      ? sourceHint(data._commandSourceKey)
      : '';
    console.log(`${c.bold(label)}: ${data.command}${cmdHint}`);
  } else if (data.executor) {
    console.log(
      `${c.bold('Executor')}: ${data.executor}${sourceHint('executor')}`
    );
  }

  if (data.customHasher) {
    console.log(
      `${c.bold('Hasher')}: ${c.yellow('custom')} ${c.dim('(inputs do not affect cache hash)')}`
    );
  }

  if (data.configuration)
    console.log(`${c.bold('Configuration')}: ${data.configuration}`);

  if (data.dependsOn && data.dependsOn.length > 0) {
    console.log(`${c.bold('Depends On')}:`);
    for (let i = 0; i < data.dependsOn.length; i++) {
      const hint =
        data._depSources?.[i] !== undefined
          ? sourceHint(`dependsOn.${data._depSources[i]}`, 'dependsOn')
          : '';
      console.log(`  ${data.dependsOn[i]}${hint}`);
    }
  }

  console.log(
    `${c.bold('Parallelism')}: ${data.parallelism}${sourceHint('parallelism')}`
  );
  console.log(
    `${c.bold('Continuous')}: ${data.continuous}${sourceHint('continuous')}`
  );
  console.log(`${c.bold('Cache')}: ${data.cache}${sourceHint('cache')}`);

  if (data.inputs && data.inputs.length > 0) {
    console.log(`${c.bold('Inputs')}:`);
    const inputSources = data._inputSources;
    // Build sortable entries with their source index
    const entries = data.inputs.map((input, i) => ({
      value: input,
      sourceIndex: inputSources?.[i],
    }));
    entries.sort((a, b) => {
      const aIsString = typeof a.value === 'string';
      const bIsString = typeof b.value === 'string';
      if (!aIsString && bIsString) return 1;
      if (aIsString && !bIsString) return -1;
      if (aIsString && bIsString) {
        const aStr = a.value as string;
        const bStr = b.value as string;
        const aIsDep = aStr.startsWith('^');
        const bIsDep = bStr.startsWith('^');
        if (aIsDep && !bIsDep) return 1;
        if (!aIsDep && bIsDep) return -1;
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      }
      return 0;
    });
    for (const { value, sourceIndex } of entries) {
      const display = typeof value === 'string' ? value : JSON.stringify(value);
      const hint =
        sourceIndex !== undefined
          ? sourceHint(`inputs.${sourceIndex}`, 'inputs')
          : '';
      console.log(`  - ${display}${hint}`);
    }
  }

  if (data.outputs && data.outputs.length > 0) {
    console.log(`${c.bold('Outputs')}:`);
    for (let i = 0; i < data.outputs.length; i++) {
      const hint = sourceHint(`outputs.${i}`, 'outputs');
      console.log(`  - ${data.outputs[i]}${hint}`);
    }
  }

  // When command is hoisted, hide the corresponding option key from display
  const hoistedOptionKey = data._commandSourceKey?.startsWith('options.')
    ? data._commandSourceKey.slice('options.'.length)
    : undefined;
  const displayOptions = Object.entries(data.options).filter(
    ([key]) => key !== hoistedOptionKey
  );

  if (displayOptions.length > 0) {
    console.log(`${c.bold('Options')}:`);
    for (const [key, value] of displayOptions) {
      const hint = sourceHint(`options.${key}`);
      if (typeof value === 'object' && value !== null) {
        console.log(`  ${key}:${hint}`);
        const lines = JSON.stringify(value, null, 2).split('\n');
        for (const line of lines) {
          console.log(`    ${line}`);
        }
      } else {
        console.log(`  ${key}: ${JSON.stringify(value)}${hint}`);
      }
    }
  }

  if (data.configurations && data.configurations.length > 0) {
    const configList = data.configurations
      .map((cfg) =>
        cfg === data.defaultConfiguration ? `${cfg} ${c.dim('(default)')}` : cfg
      )
      .join(', ');
    console.log(`${c.bold('Configurations')}: ${configList}`);
  }

  console.log('');
}
